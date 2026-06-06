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
