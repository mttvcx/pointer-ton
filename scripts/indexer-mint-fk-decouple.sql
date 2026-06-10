-- Decouple indexer / desk cache tables from tokens row lifecycle.
-- mint is the stable key; deleting tokens must NOT wipe chain history.
-- Run in Supabase SQL editor, then scripts/reload-postgrest-schema.sql

ALTER TABLE IF EXISTS mint_swaps
  DROP CONSTRAINT IF EXISTS mint_swaps_mint_fkey;

ALTER TABLE IF EXISTS mint_wallet_stats
  DROP CONSTRAINT IF EXISTS mint_wallet_stats_mint_fkey;

ALTER TABLE IF EXISTS token_holders
  DROP CONSTRAINT IF EXISTS token_holders_mint_fkey;

ALTER TABLE IF EXISTS token_market_snapshots
  DROP CONSTRAINT IF EXISTS token_market_snapshots_mint_fkey;

CREATE INDEX IF NOT EXISTS mint_swaps_mint_only_idx ON mint_swaps (mint);
CREATE INDEX IF NOT EXISTS mint_wallet_stats_mint_only_idx ON mint_wallet_stats (mint);
