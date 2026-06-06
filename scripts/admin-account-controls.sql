-- Admin v1 — emergency account controls (superadmin kill-switch / "Account Guardian").
-- Run in Supabase SQL editor, then scripts/reload-postgrest-schema.sql.
--
-- Lets a superadmin FREEZE a user's trading/automation server-side during an
-- emergency (e.g. a hijacked copy-trade draining the wallet). Because every
-- order's swap transaction is minted server-side in /api/trade/quote, a freeze
-- here stops the drain for ALL wallet types (no transaction is ever produced to
-- sign). This is a protective stop only — it does NOT grant key custody.

CREATE TABLE IF NOT EXISTS account_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'frozen',     -- frozen | released
  scope text NOT NULL DEFAULT 'all',         -- all | trading | automation
  reason text NOT NULL,
  created_by uuid REFERENCES users(id),      -- null = system break-glass
  created_at timestamptz NOT NULL DEFAULT now(),
  released_by uuid REFERENCES users(id),
  released_reason text,
  released_at timestamptz
);

-- At most one ACTIVE (frozen) control per user.
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_controls_active
  ON account_controls (user_id)
  WHERE status = 'frozen';

CREATE INDEX IF NOT EXISTS idx_account_controls_user
  ON account_controls (user_id, created_at DESC);

-- Deny-all RLS: only the service role (server) may touch this table.
ALTER TABLE account_controls ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
