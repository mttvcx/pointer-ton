import 'server-only';

import { PublicKey } from '@solana/web3.js';
import { getConnection, getPublicSolanaConnection, isRpcQuotaError } from '@/lib/solana/connection';
import { getPacksTreasuryPubkey } from '@/lib/packs/treasury';
import { evaluatePaymentDelta } from '@/lib/packs/paymentMath';

export { evaluatePaymentDelta };

export type PackPaymentResult =
  | { ok: true; creditedLamports: number; treasury: string }
  | { ok: false; reason: string };

async function getParsedTx(signature: string) {
  const opts = { maxSupportedTransactionVersion: 0 as const, commitment: 'confirmed' as const };
  try {
    return await getConnection().getParsedTransaction(signature, opts);
  } catch (err) {
    if (!isRpcQuotaError(err)) throw err;
    return await getPublicSolanaConnection().getParsedTransaction(signature, opts);
  }
}

/**
 * Verify on-chain that `payer` transferred at least `expectedLamports` (minus
 * tolerance) of SOL to the packs treasury in transaction `signature`. Uses the
 * net treasury balance delta from pre/post balances, so it is robust to the
 * exact instruction layout (system transfer, multiple ix, etc.).
 *
 * Idempotency (no replay) is enforced separately by the UNIQUE pack_payments.payment_tx
 * row — this function only attests that the on-chain transfer happened.
 */
export async function verifyPackPayment(input: {
  signature: string;
  payer: string;
  expectedLamports: number;
  toleranceBps?: number;
}): Promise<PackPaymentResult> {
  const treasury = getPacksTreasuryPubkey();
  if (!treasury) return { ok: false, reason: 'treasury_not_configured' };

  let payerPk: PublicKey;
  try {
    payerPk = new PublicKey(input.payer);
  } catch {
    return { ok: false, reason: 'invalid_payer' };
  }

  let tx;
  try {
    tx = await getParsedTx(input.signature);
  } catch {
    return { ok: false, reason: 'rpc_error' };
  }
  if (!tx) return { ok: false, reason: 'tx_not_found' };
  if (tx.meta?.err) return { ok: false, reason: 'tx_failed' };

  const keys = tx.transaction.message.accountKeys;
  const treasuryAddr = treasury.toBase58();
  const payerAddr = payerPk.toBase58();

  const treasuryIdx = keys.findIndex((k) => k.pubkey.toBase58() === treasuryAddr);
  const payerEntry = keys.find((k) => k.pubkey.toBase58() === payerAddr);
  if (treasuryIdx < 0) return { ok: false, reason: 'treasury_not_in_tx' };
  if (!payerEntry || !payerEntry.signer) return { ok: false, reason: 'payer_not_signer' };

  const pre = tx.meta?.preBalances ?? [];
  const post = tx.meta?.postBalances ?? [];
  const credited = (post[treasuryIdx] ?? 0) - (pre[treasuryIdx] ?? 0);

  const verdict = evaluatePaymentDelta(credited, input.expectedLamports, input.toleranceBps);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };

  return { ok: true, creditedLamports: credited, treasury: treasuryAddr };
}
