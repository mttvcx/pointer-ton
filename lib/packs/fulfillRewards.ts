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
import { getConnection } from '@/lib/solana/connection';
import { getQuote } from '@/lib/jupiter/quote';
import { getSwapTx } from '@/lib/jupiter/swap';
import { submitTransaction } from '@/lib/solana/submit';
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

/**
 * LIVE SEAM — server-signed, real-money pack fulfillment.
 *
 * For each won token reward the packs treasury:
 *   1. buys `lamportsToSpend` of the token on Jupiter (treasury signs, no
 *      platform fee — the house edge is already baked into the pack price), then
 *   2. transfers the received tokens to the user's wallet (treasury pays ATA rent).
 *
 * GATED behind {@link isPacksTreasuryConfigured}. Untested without a funded
 * treasury on mainnet — VERIFY LIVE before enabling `PACKS_LIVE_COMMERCE_ENABLED`.
 * Per-reward failures are isolated and reported; a failed reward does not abort
 * the others (reconcile/refund from the returned report).
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

    // 1) Treasury buys the token (SOL -> token), no platform fee on delivery buys.
    const quote = await getQuote({
      userId: 'packs-treasury',
      inputMint: SOL_MINT,
      outputMint: intent.mint,
      amountRaw: String(intent.lamportsToSpend),
      slippageBps: 500,
      dynamicSlippage: true,
      feeBpsOverride: 0,
    });
    const swap = await getSwapTx(quote, treasury.publicKey.toBase58(), { landing: 'jito' });
    const buyTx = signAndSerialize(swap.swapTransaction, treasury);
    const buyRes = await submitTransaction(buyTx);
    if (buyRes.status !== 'confirmed') {
      return { ...base, error: `buy_failed:${buyRes.error ?? 'unknown'}`, buyTx: buyRes.signature };
    }
    base.buyTx = buyRes.signature;

    // 2) Transfer the received tokens to the user (treasury creates the user ATA).
    const acct = await getAccount(conn, treasuryAta);
    const deliverAmount = acct.amount; // bigint — full treasury balance of this mint
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
    const transferRes = await submitTransaction(transferVtx.serialize());
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
