-- BLOCKER-2 (money double-credit race) fix.
--
-- `/api/trade/execute` deduped a retried/concurrent submit with a bare
-- check-then-insert on tx_signature (getTradeBySignature → insertTrade) with NO
-- backing constraint. Two concurrent calls for the SAME signature both pass the
-- check, both insert trade rows with DIFFERENT random UUIDs, and cashback +
-- referral (keyed on trade.id) then accrue twice — a double real payout.
--
-- This UNIQUE index makes trade creation idempotent: the loser of the insert race
-- gets SQLSTATE 23505, and `insertTrade` then returns the winner's row, so both
-- requests converge on ONE trade.id and the existing per-trade accrual indexes
-- dedupe to exactly-once.
--
-- Partial: NULL/blank signatures (shouldn't exist; column is NOT NULL) unconstrained.
-- Verified no existing duplicate signatures before applying (count = 0).
-- Apply ONCE. Idempotent.

create unique index if not exists trades_tx_signature_uniq
  on public.trades (tx_signature)
  where tx_signature is not null and btrim(tx_signature) <> '';
