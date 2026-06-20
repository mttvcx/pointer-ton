/**
 * Pure pack-payment math (no server-only deps) so it is unit-testable.
 *
 * Is `creditedLamports` enough to satisfy `expectedLamports`, allowing
 * `toleranceBps` of downward drift (SOL price can move between the quote and
 * the signed payment)?
 */
export function evaluatePaymentDelta(
  creditedLamports: number,
  expectedLamports: number,
  toleranceBps = 200,
): { ok: true } | { ok: false; reason: string } {
  if (!(expectedLamports > 0)) return { ok: false, reason: 'invalid_expected_amount' };
  const minLamports = Math.floor((expectedLamports * (10_000 - toleranceBps)) / 10_000);
  if (creditedLamports < minLamports) return { ok: false, reason: 'insufficient_payment' };
  return { ok: true };
}
