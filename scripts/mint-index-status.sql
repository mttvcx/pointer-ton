-- Per-mint indexer status — drives chain-tape / top-traders availability in the desk UI.
-- Run in Supabase SQL editor, then scripts/reload-postgrest-schema.sql

CREATE TABLE IF NOT EXISTS mint_index_status (
  mint text PRIMARY KEY,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'indexing', 'indexed', 'no_swaps', 'failed')),
  last_started_at timestamptz,
  last_indexed_at timestamptz,
  swap_count integer,
  signature_count integer,
  wallet_count integer,
  top_trader_count integer,
  primary_pool text,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mint_index_status_status_idx
  ON mint_index_status (status, updated_at DESC);
