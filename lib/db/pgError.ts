/**
 * Postgres / PostgREST error helpers — pure, no I/O (unit-testable).
 *
 * Money accruals (cashback, referral, points) dedupe with a check-then-insert:
 * SELECT "does a row for this trade exist?" then INSERT. Two concurrent calls
 * for the same trade can BOTH pass the check and BOTH insert → a double credit.
 * The durable fix is a UNIQUE index in the database so the second insert fails
 * with SQLSTATE 23505; the writer then treats that failure as an idempotent
 * no-op (the row it wanted already exists). This helper recognizes that failure.
 */

const UNIQUE_VIOLATION = '23505';

type MaybePgError = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
} | null | undefined;

/**
 * True when an error represents a Postgres unique-constraint violation — by
 * SQLSTATE code (preferred, what supabase-js returns on `error.code`) or, as a
 * fallback, the canonical message text.
 */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as MaybePgError;
  if (e && typeof e === 'object') {
    if (String(e.code ?? '') === UNIQUE_VIOLATION) return true;
    const text = `${typeof e.message === 'string' ? e.message : ''} ${typeof e.details === 'string' ? e.details : ''}`;
    if (/duplicate key value|violates unique constraint/i.test(text)) return true;
  }
  return false;
}
