-- Enable Supabase Realtime for Pulse live spawn + V/MC ticks.
-- Run once in Supabase SQL editor (Dashboard → SQL → New query).

alter publication supabase_realtime add table public.tokens;
alter publication supabase_realtime add table public.token_market_snapshots;

-- Anon clients need SELECT to subscribe (RLS may still apply).
grant select on public.tokens to anon, authenticated;
grant select on public.token_market_snapshots to anon, authenticated;
