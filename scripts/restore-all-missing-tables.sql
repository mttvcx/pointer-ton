-- ============================================================================
-- RESTORE ALL MISSING TABLES (v2) — run once in Supabase SQL Editor
-- ----------------------------------------------------------------------------
-- v2 fix: bootstrap-phase1-core.sql rebuilds indexes on the EXISTING tokens
-- table (protocol_id/chain_id cols it lacks), so we extract only user_tiers +
-- user_points from it. All other files create self-contained missing tables.
-- Idempotent (IF NOT EXISTS / ON CONFLICT). Safe + re-runnable on the live DB.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ---- user_tiers + user_points (extracted from bootstrap-phase1-core.sql) ----
CREATE TABLE IF NOT EXISTS user_tiers (
  id text PRIMARY KEY,
  name text NOT NULL,
  fee_bps integer NOT NULL,
  ai_quota_usd_daily numeric NOT NULL,
  point_multiplier numeric NOT NULL
);

INSERT INTO user_tiers (id, name, fee_bps, ai_quota_usd_daily, point_multiplier)
VALUES ('default', 'Default', 100, 0.30, 1.0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS user_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  source text NOT NULL,
  amount numeric NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_points_user_id_idx ON user_points (user_id);

-- ============================================================
-- twitter-ingest-tweets.sql
-- ============================================================
-- Tweet ingest cache with perceptual image hashes for image_match rules.
-- Run in Supabase SQL editor, then NOTIFY pgrst, 'reload schema';

create table if not exists public.twitter_ingest_tweets (
  tweet_id text primary key,
  author_handle text not null,
  text text not null default '',
  image_urls text[] not null default '{}'::text[],
  image_hashes jsonb not null default '[]'::jsonb,
  tweet_kind text,
  tweet_url text,
  raw_json jsonb,
  received_at timestamptz not null default now()
);

create index if not exists twitter_ingest_tweets_handle_idx
  on public.twitter_ingest_tweets (author_handle, received_at desc);

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- identity-schema.sql
-- ============================================================
-- Pointer identity graph (optional Supabase persistence — v1 uses in-repo JSON seeds + runtime registry).
-- Run in SQL editor, then: notify pgrst, 'reload schema';

create table if not exists identity_profiles (
  id uuid primary key default uuid_generate_v4(),
  display_name text not null,
  normalized_display_name text not null,
  avatar_url text,
  twitter_handle text,
  telegram_handle text,
  website_url text,
  notes text,
  primary_category text not null default 'kol',
  badges jsonb not null default '[]'::jsonb,
  verified boolean not null default false,
  source_priority int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists identity_wallets (
  id uuid primary key default uuid_generate_v4(),
  identity_id uuid not null references identity_profiles(id) on delete cascade,
  chain text not null check (chain in ('sol', 'eth', 'bnb', 'base', 'ton')),
  address text not null,
  normalized_address text not null,
  address_type text not null check (address_type in ('solana', 'evm')),
  label text,
  source text not null,
  source_url text,
  confidence real not null default 0.75,
  verified boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (chain, normalized_address)
);

create index if not exists identity_wallets_chain_norm_idx on identity_wallets(chain, normalized_address);

notify pgrst, 'reload schema';

-- ============================================================
-- mint-swaps-indexer.sql
-- ============================================================
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

-- ============================================================
-- mint-index-status.sql
-- ============================================================
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

-- ============================================================
-- helius-usage.sql
-- ============================================================
-- Helius RPC / DAS credit usage log. Run in Supabase SQL editor, then:
--   scripts/reload-postgrest-schema.sql

create table if not exists public.helius_usage (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  credits_estimated integer not null,
  success boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists helius_usage_created_at_idx
  on public.helius_usage (created_at desc);

create index if not exists helius_usage_endpoint_created_idx
  on public.helius_usage (endpoint, created_at desc);

comment on table public.helius_usage is
  'Append-only Helius credit estimates for admin burn-rate monitoring.';

-- ============================================================
-- admin-rbac.sql
-- ============================================================
-- Admin v1 — Control Room RBAC + universal audit log.
-- Run in Supabase SQL editor, then run scripts/reload-postgrest-schema.sql.
--
-- Design: admins are *real* Privy users (FK -> users.id) flagged here. Roles
-- carry a permissions text[] (wildcard '*' = superadmin). Every admin mutation
-- writes one admin_audit_log row attributed to admin_user_id.

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  permissions text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_user_roles (
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_user_id, role_id)
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_label text NOT NULL,            -- wallet/username snapshot or 'system'
  action text NOT NULL,                 -- e.g. 'packs.override.create'
  target_type text NOT NULL,            -- e.g. 'user' | 'pack_override'
  target_id text,
  reason text,
  before jsonb,
  after jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_log (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_log (target_type, target_id);

-- Seed the four canonical roles. Permission keys mirror lib/admin/permissions.ts.
INSERT INTO admin_roles (key, name, description, permissions) VALUES
  ('superadmin', 'Super Admin', 'Full access to every control-room action.', ARRAY['*']),
  ('support', 'Support', 'Read user data and triage bug reports.',
    ARRAY['users.read','referrals.read','packs.read','bugreports.read','bugreports.write','identity.read','campaigns.read','championship.read','audit.read']),
  ('economy', 'Economy', 'Manage points, referrals, cashback, campaigns and pack overrides.',
    ARRAY['users.read','points.grant','referrals.read','referrals.payout','cashback.grant','campaigns.read','campaigns.grant','packs.read','packs.override','flags.read','audit.read']),
  ('reviewer', 'Reviewer', 'Review/finalize championship and approve pack overrides.',
    ARRAY['users.read','championship.read','championship.review','championship.finalize','packs.read','packs.override.approve','audit.read'])
ON CONFLICT (key) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      permissions = EXCLUDED.permissions;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- admin-packs.sql
-- ============================================================
-- Admin v1 — pack open history + override queue.
-- Run in Supabase SQL editor, then scripts/reload-postgrest-schema.sql.

-- Every pack open (simulated or live) is persisted here for audit/history.
CREATE TABLE IF NOT EXISTS pack_opens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  open_id text NOT NULL,                 -- result.openId from the engine
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  pack_type text NOT NULL,
  price_sol numeric NOT NULL DEFAULT 0,
  sol_usd numeric,
  highlight_rarity text,
  total_token_value_sol numeric,
  house_edge_bps integer,
  is_override boolean NOT NULL DEFAULT false,
  override_id uuid,
  simulated boolean NOT NULL DEFAULT true,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pack_opens_user ON pack_opens (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pack_opens_created ON pack_opens (created_at DESC);

-- Admin-issued forced outcome for a user's next applicable pack open.
-- High-value outcomes (jackpot, legendary_elite) require approval by a second
-- admin (approver != creator). Every override carries a reason + expiry.
CREATE TABLE IF NOT EXISTS pack_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_type text,                        -- null = applies to any pack type
  forced_outcome text NOT NULL,          -- 'jackpot' | 'legendary_elite' | 'epic_surge'
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending|approved|consumed|rejected|expired
  requires_approval boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  rejected_reason text,
  expires_at timestamptz NOT NULL,
  consumed_open_id text,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pack_overrides_target ON pack_overrides (target_user_id, status);
CREATE INDEX IF NOT EXISTS idx_pack_overrides_status ON pack_overrides (status, expires_at);

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- admin-cashback.sql
-- ============================================================
-- Admin v1 — cashback ledger (replaces the env-demo claimable balance).
-- Run in Supabase SQL editor, then scripts/reload-postgrest-schema.sql.

CREATE TABLE IF NOT EXISTS cashback_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_sol numeric NOT NULL,           -- positive = credit, negative = claim/debit
  kind text NOT NULL DEFAULT 'grant',    -- grant | accrual | claim | adjustment
  reason text,
  status text NOT NULL DEFAULT 'available', -- available | claimed | void
  created_by uuid REFERENCES users(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cashback_user ON cashback_ledger (user_id, created_at DESC);

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- admin-campaigns.sql
-- ============================================================
-- Admin v1 — campaign + grant system.
-- Run in Supabase SQL editor, then scripts/reload-postgrest-schema.sql.

CREATE TABLE IF NOT EXISTS admin_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  grant_type text NOT NULL,              -- points | cashback | pack_override
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',  -- draft | active | paused | ended
  reason text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES admin_campaigns(id) ON DELETE SET NULL,
  target_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grant_type text NOT NULL,              -- points | cashback
  amount numeric NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'applied', -- applied | reverted
  created_by uuid REFERENCES users(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_grants_campaign ON admin_grants (campaign_id);
CREATE INDEX IF NOT EXISTS idx_admin_grants_target ON admin_grants (target_user_id);

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- admin-feature-flags.sql
-- ============================================================
-- Admin v1 — runtime feature flags.
-- Run in Supabase SQL editor, then scripts/reload-postgrest-schema.sql.

CREATE TABLE IF NOT EXISTS feature_flags (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'false'::jsonb,
  description text,
  -- When false, writes are blocked in production (dev-only flag). The control
  -- room refuses to toggle these in prod unless allow_prod is set true.
  allow_prod boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- admin-emergency-actions.sql
-- ============================================================
-- Emergency admin rescue audit (server-signed protective sells).
-- Run after admin-account-controls.sql, then reload-postgrest-schema.sql.

CREATE TABLE IF NOT EXISTS emergency_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action text NOT NULL,                 -- e.g. emergency_sell | emergency_sell_all
  wallet_address text NOT NULL,
  mint text,                            -- null when sell_all
  tx_signature text,
  status text NOT NULL DEFAULT 'pending', -- pending | confirmed | failed
  reason text NOT NULL,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  performed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emergency_actions_user ON emergency_actions (target_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS wallet_signer_provisions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  privy_wallet_id text,
  status text NOT NULL DEFAULT 'active',  -- active | revoked | failed
  provisioned_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz,
  PRIMARY KEY (user_id, wallet_address)
);

ALTER TABLE emergency_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_signer_provisions ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- admin-bug-reports.sql
-- ============================================================
-- Admin v1 — persisted bug reports (previously webhook-only).
-- Run in Supabase SQL editor, then scripts/reload-postgrest-schema.sql.

CREATE TABLE IF NOT EXISTS bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL,
  description text NOT NULL,
  route text,
  active_chain text,
  mint_hint text,
  wallet_masked text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'new',   -- new | triaged | resolved | spam
  triaged_by uuid REFERENCES users(id),
  triaged_at timestamptz,
  delivered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports (status, created_at DESC);

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- admin-championship.sql
-- ============================================================
-- Admin v1 — championship persistence + review/finalization.
-- Run in Supabase SQL editor, then scripts/reload-postgrest-schema.sql.

CREATE TABLE IF NOT EXISTS championship_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text NOT NULL DEFAULT 'global',
  week_index integer NOT NULL DEFAULT 0,
  week_label text NOT NULL,
  season_id text NOT NULL,
  season_label text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  review_ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'upcoming', -- upcoming|live|reviewing|finalized
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS championship_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES championship_events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  handle text,
  wallet_address text,
  avatar_url text,
  realized_pnl_usd numeric NOT NULL DEFAULT 0,
  event_volume_usd numeric NOT NULL DEFAULT 0,
  closed_trades integer NOT NULL DEFAULT 0,
  profitable_closed_trades integer NOT NULL DEFAULT 0,
  unique_tokens_traded integer NOT NULL DEFAULT 0,
  biggest_win_roi_pct numeric NOT NULL DEFAULT 0,
  roi_pct numeric NOT NULL DEFAULT 0,
  max_drawdown_pct numeric NOT NULL DEFAULT 0,
  suspicious_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_status text NOT NULL DEFAULT 'eligible',
  closed_trade_rois_pct jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_champ_participants_event ON championship_participants (event_id);

CREATE TABLE IF NOT EXISTS championship_finalizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES championship_events(id) ON DELETE CASCADE,
  leaderboard jsonb NOT NULL DEFAULT '[]'::jsonb,
  finalized_by uuid REFERENCES users(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

NOTIFY pgrst, 'reload schema';

NOTIFY pgrst, 'reload schema';
