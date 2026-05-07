/** Portion of Jupiter platform fee (basis points) credited to referrers. */
export function referralFeeShareBps(): number {
  const raw = Number(
    process.env.REFERRAL_FEE_SHARE_BPS ?? process.env.NEXT_PUBLIC_REFERRAL_FEE_SHARE_BPS,
  );
  if (Number.isFinite(raw) && raw >= 0 && raw <= 10_000) return Math.floor(raw);
  return 3000;
}
