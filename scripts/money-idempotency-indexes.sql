-- Money-path idempotency: enforce exactly-once accruals at the DATABASE level.
--
-- Cashback / referral / points accruals dedupe in app code with a check-then-
-- insert (SELECT exists? then INSERT). Two concurrent calls for the same trade
-- can both pass the check and both insert -> a double credit. These partial
-- UNIQUE indexes make the second insert fail with SQLSTATE 23505, which the app
-- now catches and treats as an idempotent no-op (see lib/db/pgError.ts).
--
-- Apply ONCE (e.g. Supabase SQL editor). Safe to re-run: indexes use
-- IF NOT EXISTS. The DELETE steps remove pre-existing duplicate OVER-CREDITS
-- (keeping the earliest row); review the preview counts first.
--
-- NOTE: a unique index cannot be created while duplicate rows exist, so the
-- de-dup must run before the matching CREATE INDEX.

-- ============================ 1. cashback_ledger ============================
-- Preview duplicates (run on its own to inspect before deleting):
--   SELECT metadata->>'trade_id' AS trade_id, count(*)
--   FROM cashback_ledger
--   WHERE kind = 'accrual' AND metadata->>'trade_id' IS NOT NULL
--   GROUP BY 1 HAVING count(*) > 1;

DELETE FROM cashback_ledger a
USING cashback_ledger b
WHERE a.kind = 'accrual'
  AND b.kind = 'accrual'
  AND a.metadata->>'trade_id' IS NOT NULL
  AND a.metadata->>'trade_id' = b.metadata->>'trade_id'
  AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id));

CREATE UNIQUE INDEX IF NOT EXISTS cashback_ledger_accrual_trade_id_uniq
  ON cashback_ledger ((metadata->>'trade_id'))
  WHERE kind = 'accrual' AND (metadata->>'trade_id') IS NOT NULL;

-- ============================ 2. referral_earnings ==========================
-- Preview:
--   SELECT trade_id, count(*) FROM referral_earnings
--   WHERE trade_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1;

DELETE FROM referral_earnings a
USING referral_earnings b
WHERE a.trade_id IS NOT NULL
  AND a.trade_id = b.trade_id
  AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id));

CREATE UNIQUE INDEX IF NOT EXISTS referral_earnings_trade_id_uniq
  ON referral_earnings (trade_id)
  WHERE trade_id IS NOT NULL;

-- ============================ 3. points_events ==============================
-- Preview:
--   SELECT user_id, event_type, metadata->>'dedupe_key' AS dedupe_key, count(*)
--   FROM points_events WHERE metadata->>'dedupe_key' IS NOT NULL
--   GROUP BY 1,2,3 HAVING count(*) > 1;

DELETE FROM points_events a
USING points_events b
WHERE a.metadata->>'dedupe_key' IS NOT NULL
  AND a.user_id = b.user_id
  AND a.event_type = b.event_type
  AND a.metadata->>'dedupe_key' = b.metadata->>'dedupe_key'
  AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.id > b.id));

CREATE UNIQUE INDEX IF NOT EXISTS points_events_user_event_dedupe_uniq
  ON points_events (user_id, event_type, (metadata->>'dedupe_key'))
  WHERE (metadata->>'dedupe_key') IS NOT NULL;
