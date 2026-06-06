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
