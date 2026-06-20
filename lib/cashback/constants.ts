/**
 * Cashback economics.
 *
 * Cashback is the rebate the *trader themselves* earns back on the platform fee
 * they pay — distinct from referral fee share (which pays the *referrer*). The
 * two stack: of every platform fee, {@link cashbackShareBps} is rebated to the
 * trader and {@link referralFeeShareBps} is credited to their referrer.
 */

/** Portion of the trader's own platform fee (basis points) rebated as cashback. */
export function cashbackShareBps(): number {
  const raw = Number(
    process.env.CASHBACK_SHARE_BPS ?? process.env.NEXT_PUBLIC_CASHBACK_SHARE_BPS,
  );
  if (Number.isFinite(raw) && raw >= 0 && raw <= 10_000) return Math.floor(raw);
  return 5000;
}

/** Whole-number cashback percent for UI copy (e.g. 50). */
export function cashbackSharePct(): number {
  return Math.round(cashbackShareBps() / 100);
}
