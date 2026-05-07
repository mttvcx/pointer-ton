-- Phase 2 Steps 9-13 — run in Supabase SQL editor before using new features.
-- Idempotent-ish: use IF NOT EXISTS where practical.

-- Trading presets (P1/P2/P3)
create table if not exists trading_presets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  slot int not null check (slot in (1, 2, 3)),
  name text default 'Preset',
  buy_amounts_sol numeric[] default array[0.1, 0.5, 1, 5]::numeric[],
  slippage_bps int default 500,
  dynamic_slippage boolean default true,
  priority_fee_lamports int default 100000,
  mev_mode text default 'reduced' check (mev_mode in ('off', 'reduced', 'secure')),
  jito_tip_lamports int default 100000,
  auto_fee boolean default true,
  max_fee_sol numeric default 0.1,
  unique(user_id, slot)
);
create index if not exists trading_presets_user_id_idx on trading_presets(user_id);

-- Limit alerts (user must confirm swap client-side when triggered)
create table if not exists limit_orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  mint text not null references tokens(mint),
  side text not null check (side in ('buy', 'sell')),
  trigger_price_usd numeric not null,
  amount_sol numeric,
  amount_token_pct numeric,
  slippage_bps int default 500,
  status text default 'open' check (status in ('open', 'triggered', 'filled', 'cancelled', 'expired')),
  expires_at timestamptz,
  triggered_at timestamptz,
  trigger_price_usd_at_fire numeric,
  filled_tx_signature text,
  filled_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists limit_orders_user_status_idx on limit_orders(user_id, status);
create index if not exists limit_orders_mint_open_idx on limit_orders(mint, status) where status = 'open';

-- Snapshot extended metrics (optional persistence; Phase 2 computes on read + Redis)
alter table token_market_snapshots add column if not exists extended_metrics jsonb;
