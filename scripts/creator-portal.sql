-- Pointer Creator Portal (clipping program) — run in Supabase SQL editor, then reload-postgrest-schema.sql

-- Discord-only creators (separate from Privy app users)
CREATE TABLE IF NOT EXISTS creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id text NOT NULL UNIQUE,
  discord_username text NOT NULL,
  discord_avatar text,
  discord_global_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'blacklisted')),
  payout_method text CHECK (payout_method IN ('crypto', 'paypal', 'none')),
  payout_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creators_discord_id ON creators (discord_id);
CREATE INDEX IF NOT EXISTS idx_creators_status ON creators (status);

-- Linked TikTok / IG / X accounts
CREATE TABLE IF NOT EXISTS creator_social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES creators (id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'x')),
  handle text NOT NULL,
  profile_url text,
  tier text CHECK (tier IN ('basic', 'elite')),
  verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'needs_verification', 'verified', 'rejected')),
  tier1_audience_pct numeric(5, 2),
  verified_at timestamptz,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator_id, platform, handle)
);

CREATE INDEX IF NOT EXISTS idx_creator_social_creator ON creator_social_accounts (creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_social_status ON creator_social_accounts (verification_status);

-- Demographic verification video uploads (28-day audience proof)
CREATE TABLE IF NOT EXISTS creator_verification_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES creator_social_accounts (id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES creators (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_size_bytes bigint NOT NULL,
  mime_type text NOT NULL DEFAULT 'video/mp4',
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewer_note text,
  tier1_audience_pct numeric(5, 2),
  assigned_tier text CHECK (assigned_tier IN ('basic', 'elite')),
  reviewed_at timestamptz,
  reviewed_by_discord_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_verif_account ON creator_verification_submissions (account_id);
CREATE INDEX IF NOT EXISTS idx_creator_verif_pending ON creator_verification_submissions (review_status)
  WHERE review_status = 'pending';

-- Clip submissions (post URLs)
CREATE TABLE IF NOT EXISTS creator_video_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES creators (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES creator_social_accounts (id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'x')),
  post_url text NOT NULL,
  post_url_normalized text NOT NULL,
  view_count bigint NOT NULL DEFAULT 0,
  view_count_verified boolean NOT NULL DEFAULT false,
  earnings_verified_cents bigint NOT NULL DEFAULT 0,
  earnings_unverified_cents bigint NOT NULL DEFAULT 0,
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN (
      'pending', 'approved', 'rejected', 'rejected_stolen', 'rejected_botting',
      'rejected_audience', 'reduced_pay'
    )),
  review_note text,
  month_key text NOT NULL,
  reviewed_at timestamptz,
  reviewed_by_discord_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_url_normalized)
);

CREATE INDEX IF NOT EXISTS idx_creator_videos_creator ON creator_video_submissions (creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_videos_month ON creator_video_submissions (month_key);
CREATE INDEX IF NOT EXISTS idx_creator_videos_status ON creator_video_submissions (review_status);

-- Appeals (rejections / bans)
CREATE TABLE IF NOT EXISTS creator_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES creators (id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('video', 'account', 'ban')),
  target_id uuid,
  message text NOT NULL,
  evidence_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  admin_note text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_appeals_creator ON creator_appeals (creator_id);

-- Monthly prize pool config
CREATE TABLE IF NOT EXISTS creator_prize_pools (
  month_key text PRIMARY KEY,
  total_usd_cents bigint NOT NULL DEFAULT 100000,
  payout_breakdown jsonb NOT NULL DEFAULT '[
    {"rank":1,"usdCents":30000},
    {"rank":2,"usdCents":20000},
    {"rank":3,"usdCents":15000},
    {"rank":4,"usdCents":10000},
    {"rank":5,"usdCents":8000},
    {"rank":6,"usdCents":6000},
    {"rank":7,"usdCents":4000},
    {"rank":8,"usdCents":3000},
    {"rank":9,"usdCents":2000},
    {"rank":10,"usdCents":2000}
  ]'::jsonb,
  submission_deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Blacklist (Discord IDs permanently banned)
CREATE TABLE IF NOT EXISTS creator_blacklist (
  discord_id text PRIMARY KEY,
  reason text NOT NULL,
  blacklisted_by_discord_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Audit log for admin actions (botting, stolen content flags)
CREATE TABLE IF NOT EXISTS creator_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_discord_id text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Storage bucket (run in Supabase dashboard or via API):
-- creator-verifications — private, 50MB max, video/mp4 video/quicktime
