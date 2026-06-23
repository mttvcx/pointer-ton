import 'server-only';

import {
  type Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
} from '@solana/spl-token';
import {
  getConnection,
  getPublicSolanaConnection,
  isRpcQuotaError,
} from '@/lib/solana/connection';
import { getQuote } from '@/lib/jupiter/quote';
import { getSwapTx } from '@/lib/jupiter/swap';
import { SOL_MINT } from '@/lib/utils/addresses';
import {
  getPacksTreasuryKeypair,
  isPacksTreasuryConfigured,
} from '@/lib/packs/treasury';
import type { RewardBuyIntent } from '@/lib/packs/rewardFulfillmentPlan';

export type RewardFulfillmentResult = {
  rewardId: string;
  mint: string;
  ok: boolean;
  /** Token base units delivered to the user (string for precision). */
  deliveredRaw?: string;
  buyTx?: string;
  transferTx?: string;
  error?: string;
};

// How long we poll for a treasury tx to confirm before giving up. Kept tight so
// a buy + a transfer both fit inside the open route's 60s maxDuration budget
// (mainnet confirmations are typically 5-15s; this is just a safety ceiling).
const CONFIRM_TIMEOUT_MS = 24_000;
const CONFIRM_POLL_MS = 1_200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reliable broadcast + confirm for a treasury-signed transaction.
 *
 * The previous path raced Helius-Sender + a Jito `sendBundle`; both are
 * fire-and-forget submissions that can return "accepted" without the tx ever
 * landing (Jito silently drops low-tip bundles, Sender has its own tip floor),
 * so a swap could "succeed" yet deliver nothing. We instead push the raw,
 * signed tx straight through the private Helius RPC (the same proven path as
 * pack payment broadcast) and poll the signature to a real confirmation.
 */
async function sendAndConfirm(
  serialized: Uint8Array,
): Promise<{ status: 'confirmed' | 'failed'; signature: string; error?: string }> {
  const conn = getConnection();
  const send = (c: ReturnType<typeof getConnection>) =>
    c.sendRawTransaction(serialized, { skipPreflight: true, maxRetries: 5 });

  let signature: string;
  try {
    try {
      signature = await send(conn);
    } catch (err) {
      if (!isRpcQuotaError(err)) throw err;
      signature = await send(getPublicSolanaConnection());
    }
  } catch (err) {
    return {
      status: 'failed',
      signature: '',
      error: err instanceof Error ? err.message : 'send_failed',
    };
  }

  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    let value: Awaited<ReturnType<typeof conn.getSignatureStatus>>['value'] | null = null;
    try {
      value = (await conn.getSignatureStatus(signature)).value;
    } catch {
      value = null;
    }
    if (value?.err) {
      return { status: 'failed', signature, error: JSON.stringify(value.err) };
    }
    if (value?.confirmationStatus === 'confirmed' || value?.confirmationStatus === 'finalized') {
      return { status: 'confirmed', signature };
    }
    await sleep(CONFIRM_POLL_MS);
  }
  return { status: 'failed', signature, error: 'confirmation_timeout' };
}

async function readTokenBalance(
  conn: ReturnType<typeof getConnection>,
  ata: PublicKey,
): Promise<bigint> {
  try {
    const acct = await getAccount(conn, ata);
    return acct.amount;
  } catch {
    return 0n; // ATA not created yet → zero balance
  }
}

/**
 * LIVE SEAM — server-signed, real-money pack fulfillment.
 *
 * For each won token reward the packs treasury:
 *   1. buys `lamportsToSpend` of the token on Jupiter (treasury signs, no
 *      platform fee — the house edge is already baked into the pack price), then
 *   2. transfers the newly-received tokens to the user's wallet (treasury pays ATA rent).
 *
 * GATED behind {@link isPacksTreasuryConfigured}. Per-reward failures are
 * isolated and reported; a failed reward does not abort the others
 * (reconcile/refund from the returned report).
 */
export async function fulfillPackRewards(input: {
  userWallet: string;
  intents: RewardBuyIntent[];
}): Promise<{ configured: boolean; results: RewardFulfillmentResult[] }> {
  if (!isPacksTreasuryConfigured()) {
    return { configured: false, results: [] };
  }
  const treasury = getPacksTreasuryKeypair()!;
  const conn = getConnection();

  let userPk: PublicKey;
  try {
    userPk = new PublicKey(input.userWallet);
  } catch {
    return {
      configured: true,
      results: input.intents.map((i) => ({
        rewardId: i.rewardId,
        mint: i.mint,
        ok: false,
        error: 'invalid_user_wallet',
      })),
    };
  }

  const results: RewardFulfillmentResult[] = [];
  for (const intent of input.intents) {
    results.push(await fulfillOne(conn, treasury, userPk, intent));
  }
  return { configured: true, results };
}

async function fulfillOne(
  conn: ReturnType<typeof getConnection>,
  treasury: Keypair,
  userPk: PublicKey,
  intent: RewardBuyIntent,
): Promise<RewardFulfillmentResult> {
  const base: RewardFulfillmentResult = { rewardId: intent.rewardId, mint: intent.mint, ok: false };
  try {
    const mintPk = new PublicKey(intent.mint);
    const treasuryAta = getAssociatedTokenAddressSync(mintPk, treasury.publicKey, true);

    // Snapshot the treasury's pre-buy balance so we deliver exactly what THIS
    // buy yields (not any unrelated residue left from a prior partial open).
    const beforeBalance = await readTokenBalance(conn, treasuryAta);

    // 1) Treasury buys the token (SOL -> token), no platform fee on delivery buys.
    //    `landing: 'rpc'` => Jupiter prices a priority fee for a normal RPC send,
    //    which we broadcast reliably below (no Jito bundle dependency).
    const quote = await getQuote({
      userId: 'packs-treasury',
      inputMint: SOL_MINT,
      outputMint: intent.mint,
      amountRaw: String(intent.lamportsToSpend),
      slippageBps: 500,
      dynamicSlippage: true,
      feeBpsOverride: 0,
    });
    const swap = await getSwapTx(quote, treasury.publicKey.toBase58(), { landing: 'rpc' });
    const buyTx = signAndSerialize(swap.swapTransaction, treasury);
    const buyRes = await sendAndConfirm(buyTx);
    if (buyRes.status !== 'confirmed') {
      return { ...base, error: `buy_failed:${buyRes.error ?? 'unknown'}`, buyTx: buyRes.signature };
    }
    base.buyTx = buyRes.signature;

    // 2) Transfer the newly-received tokens to the user (treasury creates the user ATA).
    const afterBalance = await readTokenBalance(conn, treasuryAta);
    const deliverAmount = afterBalance > beforeBalance ? afterBalance - beforeBalance : 0n;
    if (deliverAmount <= 0n) {
      return { ...base, error: 'no_tokens_received' };
    }
    const userAta = getAssociatedTokenAddressSync(mintPk, userPk, true);
    const { blockhash } = await conn.getLatestBlockhash('confirmed');
    const msg = new TransactionMessage({
      payerKey: treasury.publicKey,
      recentBlockhash: blockhash,
      instructions: [
        createAssociatedTokenAccountIdempotentInstruction(
          treasury.publicKey,
          userAta,
          userPk,
          mintPk,
          TOKEN_PROGRAM_ID,
        ),
        createTransferInstruction(
          treasuryAta,
          userAta,
          treasury.publicKey,
          deliverAmount,
          [],
          TOKEN_PROGRAM_ID,
        ),
      ],
    }).compileToV0Message();
    const transferVtx = new VersionedTransaction(msg);
    transferVtx.sign([treasury]);
    const transferRes = await sendAndConfirm(transferVtx.serialize());
    if (transferRes.status !== 'confirmed') {
      return {
        ...base,
        error: `transfer_failed:${transferRes.error ?? 'unknown'}`,
        transferTx: transferRes.signature,
      };
    }

    return {
      ...base,
      ok: true,
      deliveredRaw: deliverAmount.toString(),
      transferTx: transferRes.signature,
    };
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : 'fulfill_error' };
  }
}

function signAndSerialize(swapTransactionB64: string, treasury: Keypair): Uint8Array {
  const vtx = VersionedTransaction.deserialize(Buffer.from(swapTransactionB64, 'base64'));
  vtx.sign([treasury]);
  return vtx.serialize();
}
