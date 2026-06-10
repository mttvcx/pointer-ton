-- Chain swap indexer tables (QA vertical slice → production indexer).
-- Run in Supabase SQL editor, then scripts/reload-postgrest-schema.sql

CREATE TABLE IF NOT EXISTS mint_swaps (
  id bigserial PRIMARY KEY,
  mint text NOT NULL,
  signature text NOT NULL,
  wallet text NOT NULL,
  event_kind text NOT NULL DEFAULT 'swap' CHECK (event_kind IN ('swap', 'remove_liq', 'add_liq')),
  side text NOT NULL CHECK (side IN ('buy', 'sell')),
  token_amount_raw numeric NOT NULL,
  token_amount_ui numeric NOT NULL,
  sol_amount numeric NOT NULL,
  usd_amount numeric,
  price_usd numeric,
  market_cap_usd numeric,
  block_time timestamptz NOT NULL,
  slot bigint,
  program_id text,
  pool_address text,
  source text NOT NULL DEFAULT 'helius_enhanced',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mint_swaps_unique_leg UNIQUE (signature, wallet, mint, event_kind)
);

CREATE INDEX IF NOT EXISTS mint_swaps_mint_block_time_idx
  ON mint_swaps (mint, block_time DESC);

CREATE INDEX IF NOT EXISTS mint_swaps_mint_wallet_idx
  ON mint_swaps (mint, wallet);

CREATE TABLE IF NOT EXISTS mint_wallet_stats (
  mint text NOT NULL,
  wallet text NOT NULL,
  bought_token_raw numeric NOT NULL DEFAULT 0,
  sold_token_raw numeric NOT NULL DEFAULT 0,
  buy_sol numeric NOT NULL DEFAULT 0,
  sell_sol numeric NOT NULL DEFAULT 0,
  buy_usd numeric NOT NULL DEFAULT 0,
  sell_usd numeric NOT NULL DEFAULT 0,
  avg_buy_usd numeric,
  avg_sell_usd numeric,
  realized_pnl_usd numeric NOT NULL DEFAULT 0,
  unrealized_pnl_usd numeric,
  remaining_token_raw numeric NOT NULL DEFAULT 0,
  remaining_token_ui numeric NOT NULL DEFAULT 0,
  first_trade_at timestamptz,
  last_trade_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mint, wallet)
);

CREATE INDEX IF NOT EXISTS mint_wallet_stats_mint_realized_idx
  ON mint_wallet_stats (mint, realized_pnl_usd DESC);
