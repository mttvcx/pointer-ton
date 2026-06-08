-- Pointer Phase 1 core schema (reconstructed from lib/supabase/types.ts).
-- Run FIRST on a fresh Supabase project, then scripts/bootstrap-incremental-manifest.txt

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- Tiers & users
-- ---------------------------------------------------------------------------
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

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_id text NOT NULL UNIQUE,
  wallet_address text,
  username text,
  email text,
  ai_quota_used_today numeric NOT NULL DEFAULT 0,
  ai_quota_reset_at timestamptz NOT NULL DEFAULT now(),
  tier_id text NOT NULL DEFAULT 'default' REFERENCES user_tiers (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  onboarding_completed_at timestamptz,
  onboarding_step integer NOT NULL DEFAULT 0,
  beta_granted_at timestamptz,
  starter_trackers_seeded_at timestamptz
);

CREATE TABLE IF NOT EXISTS user_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  source text NOT NULL,
  amount numeric NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_points_user_id_idx ON user_points (user_id);

-- ---------------------------------------------------------------------------
-- Tokens & market data
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tokens (
  mint text PRIMARY KEY,
  symbol text,
  name text,
  decimals integer NOT NULL DEFAULT 9,
  image_url text,
  description text,
  twitter_handle text,
  telegram_url text,
  website_url text,
  creator_wallet text,
  launch_pad text,
  protocol_id text,
  protocol_family text,
  chain_id text,
  token_kind text,
  launch_type text,
  migration_state text,
  dex_id text,
  classification_source text,
  source_confidence numeric(4, 3),
  classification_updated_at timestamptz,
  raw_metadata jsonb,
  initial_liquidity_sol numeric,
  initial_liquidity_at timestamptz,
  migrated_at timestamptz,
  migrated_to text,
  bonding_progress double precision,
  mint_authority text,
  freeze_authority text,
  is_lp_locked boolean,
  is_paid boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS token_market_snapshots (
  id bigserial PRIMARY KEY,
  mint text NOT NULL REFERENCES tokens (mint) ON DELETE CASCADE,
  market_cap_usd numeric,
  liquidity_usd numeric,
  price_usd numeric,
  volume_5m_usd numeric,
  volume_1h_usd numeric,
  volume_24h_usd numeric,
  txns_5m integer,
  txns_1h integer,
  holder_count integer,
  top10_holder_pct numeric,
  dev_holding_pct numeric,
  extended_metrics jsonb,
  snapshot_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS token_market_snapshots_mint_idx ON token_market_snapshots (mint);
CREATE INDEX IF NOT EXISTS token_market_snapshots_snapshot_at_idx ON token_market_snapshots (snapshot_at DESC);

CREATE TABLE IF NOT EXISTS token_embeddings (
  mint text PRIMARY KEY REFERENCES tokens (mint) ON DELETE CASCADE,
  embedding vector(1536),
  embedded_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS token_holders (
  id bigserial PRIMARY KEY,
  mint text NOT NULL REFERENCES tokens (mint) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  amount_raw text NOT NULL,
  pct_of_supply numeric,
  is_dev boolean,
  is_sniper boolean,
  rank integer,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS token_holders_mint_idx ON token_holders (mint);

-- ---------------------------------------------------------------------------
-- Trading & presets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  mint text NOT NULL REFERENCES tokens (mint),
  side text NOT NULL CHECK (side IN ('buy', 'sell')),
  amount_in_raw text NOT NULL,
  amount_out_raw text NOT NULL,
  amount_sol numeric,
  amount_token numeric,
  price_usd_at_fill numeric,
  tx_signature text NOT NULL,
  fee_paid_lamports bigint,
  platform_fee_lamports bigint,
  priority_fee_lamports bigint,
  jito_tip_lamports bigint,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  failure_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

CREATE INDEX IF NOT EXISTS trades_user_id_idx ON trades (user_id);
CREATE INDEX IF NOT EXISTS trades_mint_idx ON trades (mint);

CREATE TABLE IF NOT EXISTS column_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  column_id text NOT NULL,
  preset_slot integer NOT NULL,
  name text,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_options jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_by text NOT NULL DEFAULT 'created_at',
  sort_dir text NOT NULL DEFAULT 'desc',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, column_id, preset_slot)
);

CREATE TABLE IF NOT EXISTS user_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  label text,
  wallet_address text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  slot integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  is_imported boolean NOT NULL DEFAULT false,
  balance_lamports bigint,
  balance_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_wallets_user_id_idx ON user_wallets (user_id);

-- ---------------------------------------------------------------------------
-- Tracking & stats
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tracked_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  label text,
  notify boolean NOT NULL DEFAULT true,
  group_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tracked_wallets_user_id_idx ON tracked_wallets (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS tracked_wallets_user_wallet_uidx
  ON tracked_wallets (user_id, wallet_address);

CREATE TABLE IF NOT EXISTS wallet_stats (
  wallet_address text PRIMARY KEY,
  pnl_usd_30d numeric,
  pnl_usd_7d numeric,
  pnl_usd_24h numeric,
  win_rate_30d numeric,
  trades_30d integer,
  best_trade_multiple numeric,
  avg_hold_seconds numeric,
  total_volume_30d_usd numeric,
  is_kol boolean,
  kol_handle text,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dev_wallet_stats (
  wallet_address text PRIMARY KEY,
  tokens_launched integer NOT NULL DEFAULT 0,
  tokens_mooned integer NOT NULL DEFAULT 0,
  tokens_rugged integer NOT NULL DEFAULT 0,
  tokens_active integer NOT NULL DEFAULT 0,
  total_volume_generated_usd numeric,
  reputation_score numeric,
  median_time_to_rug_seconds numeric,
  last_launch_at timestamptz,
  computed_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- AI, social, alerts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL,
  pipeline text NOT NULL,
  input_hash text NOT NULL,
  user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  response jsonb NOT NULL,
  model_used text NOT NULL,
  cost_usd numeric NOT NULL,
  cache_hit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_responses_cache_key_idx ON ai_responses (cache_key);

CREATE TABLE IF NOT EXISTS social_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mint text NOT NULL REFERENCES tokens (mint) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'twitter',
  author_handle text,
  author_followers integer,
  author_verified boolean,
  content text,
  url text,
  posted_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users (id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL,
  ai_narration text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alerts_user_id_idx ON alerts (user_id);
CREATE INDEX IF NOT EXISTS alerts_created_at_idx ON alerts (created_at DESC);

CREATE TABLE IF NOT EXISTS webhook_events (
  signature text PRIMARY KEY,
  source text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Referrals & points
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_codes (
  code text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  uses_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referral_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  trade_id uuid NOT NULL REFERENCES trades (id) ON DELETE CASCADE,
  amount_lamports bigint NOT NULL,
  paid_out boolean NOT NULL DEFAULT false,
  paid_out_tx_signature text,
  paid_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS points_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  base_points numeric NOT NULL,
  multiplier numeric NOT NULL DEFAULT 1,
  final_points numeric NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS points_events_user_id_idx ON points_events (user_id);

-- Points leaderboard materialized view
DROP MATERIALIZED VIEW IF EXISTS points_leaderboard;
CREATE MATERIALIZED VIEW points_leaderboard AS
SELECT
  u.id AS user_id,
  u.username,
  u.wallet_address,
  COALESCE(SUM(pe.final_points), 0)::numeric AS total_points,
  COUNT(DISTINCT DATE(pe.created_at))::integer AS active_days,
  ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(pe.final_points), 0) DESC)::integer AS rank
FROM users u
LEFT JOIN points_events pe ON pe.user_id = u.id
GROUP BY u.id, u.username, u.wallet_address;

CREATE UNIQUE INDEX IF NOT EXISTS points_leaderboard_user_id_idx ON points_leaderboard (user_id);

-- Protocol classification indexes (P0)
CREATE INDEX IF NOT EXISTS tokens_protocol_id_idx ON tokens (protocol_id);
CREATE INDEX IF NOT EXISTS tokens_chain_protocol_idx ON tokens (chain_id, protocol_id);
CREATE INDEX IF NOT EXISTS tokens_token_kind_idx ON tokens (token_kind);
CREATE INDEX IF NOT EXISTS tokens_migration_state_idx ON tokens (migration_state);

-- Pulse feed indexes
CREATE INDEX IF NOT EXISTS tokens_created_at_idx ON tokens (created_at DESC);
CREATE INDEX IF NOT EXISTS tokens_migrated_at_idx ON tokens (migrated_at DESC) WHERE migrated_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS tokens_bonding_progress_idx ON tokens (bonding_progress DESC) WHERE migrated_at IS NULL;
CREATE INDEX IF NOT EXISTS tokens_launch_pad_idx ON tokens (launch_pad);

CREATE INDEX IF NOT EXISTS idx_tokens_stretch_column
  ON tokens (bonding_progress DESC, created_at DESC)
  WHERE migrated_at IS NULL AND bonding_progress IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tokens_migrated_column
  ON tokens (migrated_at DESC)
  WHERE migrated_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
