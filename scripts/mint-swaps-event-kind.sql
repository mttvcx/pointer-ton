-- mint_swaps: add event_kind + replace unique leg constraint.
-- Run in Supabase SQL editor, then scripts/reload-postgrest-schema.sql
--
-- If ADD CONSTRAINT fails with 23505, the DELETE block below removes dupes first.

-- 1) Column (idempotent)
ALTER TABLE mint_swaps
  ADD COLUMN IF NOT EXISTS event_kind text NOT NULL DEFAULT 'swap';

-- 2) Normalize any manual typos (spaces vs underscores)
UPDATE mint_swaps SET event_kind = 'remove_liq' WHERE event_kind IN ('remove liq', 'remove-liq');
UPDATE mint_swaps SET event_kind = 'add_liq' WHERE event_kind IN ('add liq', 'add-liq');
UPDATE mint_swaps SET event_kind = 'swap' WHERE event_kind IS NULL OR event_kind = '';

-- 3) Check constraint (idempotent)
ALTER TABLE mint_swaps DROP CONSTRAINT IF EXISTS mint_swaps_event_kind_check;
ALTER TABLE mint_swaps
  ADD CONSTRAINT mint_swaps_event_kind_check
  CHECK (event_kind IN ('swap', 'remove_liq', 'add_liq'));

-- 4) Remove duplicate legs before unique index (keeps highest id per leg)
DELETE FROM mint_swaps AS a
USING mint_swaps AS b
WHERE a.signature = b.signature
  AND a.wallet = b.wallet
  AND a.mint = b.mint
  AND a.event_kind = b.event_kind
  AND a.id < b.id;

-- 5) Replace unique constraint
ALTER TABLE mint_swaps DROP CONSTRAINT IF EXISTS mint_swaps_unique_leg;
ALTER TABLE mint_swaps
  ADD CONSTRAINT mint_swaps_unique_leg UNIQUE (signature, wallet, mint, event_kind);
