-- Pointer subscriptions — grants AI access (alternative to the ≥5 SOL holdings
-- path). One active row per user while subscribed. Read by lib/access/subscription.ts.
-- Apply once (Supabase SQL editor). Safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  plan                text not null default 'pro',
  status              text not null default 'active',   -- active | canceled | past_due | expired
  provider            text,                             -- stripe | crypto | manual | ...
  provider_ref        text,                             -- external subscription id
  current_period_end  timestamptz,                      -- null = no expiry (e.g. lifetime/manual)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- One ACTIVE subscription per user (idempotent grants).
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_active_uniq
  ON subscriptions (user_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions (user_id);

-- Service-role only (mirrors the other money/ops tables): RLS on, no policies.
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
