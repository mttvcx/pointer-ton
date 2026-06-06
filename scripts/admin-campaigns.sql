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
