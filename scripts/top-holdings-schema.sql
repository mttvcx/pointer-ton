-- Top-holder reverse index — "wallet X is a top-N holder of token Y".
-- A data-flywheel capture tap: filled opportunistically whenever the app resolves
-- a token's holders (already ranked by balance). Run in the Supabase SQL editor.
-- Idempotent; ends with `notify pgrst, 'reload schema'`.

create table if not exists public.wallet_top_holdings (
  wallet_address  text not null,
  mint            text not null,
  symbol          text,
  rank            integer not null,           -- 1-based rank in the holder list
  balance_ui      double precision,           -- UI-amount held at capture time
  captured_at     timestamptz not null default now(),
  primary key (wallet_address, mint)
);

-- Reverse lookup: all tokens a wallet is a top holder of, elite first.
create index if not exists wallet_top_holdings_wallet_idx
  on public.wallet_top_holdings (wallet_address, rank);
-- Forward lookup: top holders of a given token.
create index if not exists wallet_top_holdings_mint_idx
  on public.wallet_top_holdings (mint, rank);
-- Housekeeping: prune stale snapshots by age.
create index if not exists wallet_top_holdings_captured_idx
  on public.wallet_top_holdings (captured_at);

alter table public.wallet_top_holdings enable row level security;

notify pgrst, 'reload schema';
