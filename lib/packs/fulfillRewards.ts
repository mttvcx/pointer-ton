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
import { listDeliveredRewardIds, recordPackInventory } from '@/lib/db/packInventory';
import type { RewardBuyIntent } from '@/lib/packs/rewardFulfillmentPlan';

export type RewardFulfillmentResult = {
  rewardId: string;
  mint: string;
  ok: boolean;
  /** Token base units delivered to the user (string for precision). */
  deliveredRaw?: string;
  buyTx?: string;
  transferTx?: string;
  /** This reward was already delivered in a prior attempt (idempotent skip). */
  alreadyDelivered?: boolean;
  error?: string;
};

// Per-tx confirm ceiling. Tight so several buys+transfers fit inside the route's
// 60s budget; mainnet confirms are typically 5-12s — this is just a safety cap.
const CONFIRM_TIMEOUT_MS = 18_000;
const CONFIRM_POLL_MS = 1_100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reliable broadcast + confirm for a treasury-signed transaction — raw send
 * through the private Helius RPC (public-RPC fallback on quota), polled to a real
 * confirmation. NOT the old Helius-Sender + Jito race, which could report success
 * without landing.
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
 * LIVE SEAM — server-signed, real-money pack fulfillment. IDEMPOTENT + RESUMABLE.
 *
 * For each won token reward the packs treasury buys `lamportsToSpend` of the token
 * on Jupiter, then transfers it to the user. The two-tx-per-reward shape can blow
 * past a serverless time budget on multi-reward packs, so this is built to be
 * re-run safely until complete (open route after() does a first pass; the client
 * triggers /api/packs/fulfill-resume; a reconcile script can finish stragglers):
 *
 *   - rewards already in pack_inventory for this open are skipped,
 *   - a reward whose token the treasury ALREADY holds (bought before a failed
 *     transfer) skips the buy and just transfers,
 *   - each delivery is written to pack_inventory IMMEDIATELY, so partial progress
 *     survives a killed function.
 *
 * GATED behind {@link isPacksTreasuryConfigured}. Per-reward failures are isolated.
 */
export async function fulfillPackRewards(input: {
  userWallet: string;
  intents: RewardBuyIntent[];
  userId: string;
  openId: string;
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

  let delivered: Set<string>;
  try {
    delivered = await listDeliveredRewardIds(input.openId);
  } catch {
    delivered = new Set();
  }

  const results: RewardFulfillmentResult[] = [];
  for (const intent of input.intents) {
    if (delivered.has(intent.rewardId)) {
      results.push({ rewardId: intent.rewardId, mint: intent.mint, ok: true, alreadyDelivered: true });
      continue;
    }
    const r = await fulfillOne(conn, treasury, userPk, intent);
    if (r.ok && r.deliveredRaw) {
      // Persist immediately so a killed function can't undo a real delivery and a
      // re-run skips this reward.
      try {
        await recordPackInventory({
          userId: input.userId,
          mint: r.mint,
          openId: input.openId,
          rewardId: r.rewardId,
          amountRaw: r.deliveredRaw,
          acquiredTx: r.transferTx ?? r.buyTx ?? null,
        });
      } catch {
        /* best-effort — the inventory idempotency check tolerates a missing row */
      }
    }
    results.push(r);
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

    // Resume-aware: if the treasury already holds this mint, a prior attempt
    // bought it but the transfer didn't land — skip the buy and just transfer.
    let treasuryBal = await readTokenBalance(conn, treasuryAta);
    if (treasuryBal <= 0n) {
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
      treasuryBal = await readTokenBalance(conn, treasuryAta);
    }

    if (treasuryBal <= 0n) {
      return { ...base, error: 'no_tokens_received' };
    }

    // Transfer the treasury's full balance of this mint to the user (treasury
    // creates the user ATA + pays rent). Per open the rewards are distinct mints,
    // so the held balance is exactly this reward's bought amount.
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
          treasuryBal,
          [],
          TOKEN_PROGRAM_ID,
        ),
      ],
    }).compileToV0Message();
    const transferVtx = new VersionedTransaction(msg);
    transferVtx.sign([treasury]);
    const transferRes = await sendAndConfirm(transferVtx.serialize());
    if (transferRes.status !== 'confirmed') {
      // buyTx is recorded, so a resume skips the buy and retries only the transfer.
      return {
        ...base,
        error: `transfer_failed:${transferRes.error ?? 'unknown'}`,
        transferTx: transferRes.signature,
      };
    }

    return {
      ...base,
      ok: true,
      deliveredRaw: treasuryBal.toString(),
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
