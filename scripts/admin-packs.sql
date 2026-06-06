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
