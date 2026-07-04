-- Per-account auto-sell rules — server-persisted counterpart to the browser-only
-- store (store/autoSell.ts). Synced web <-> mobile. Firing is done by the auto-sell
-- executor (client today, delegated-signer engine later); the per-account kill
-- switch (account_controls) gates all firing.
--
-- Applied to prod (ajngsbnwtkmkvbgpntkd) via Supabase MCP migration `auto_sell_rules`.
-- Run in the SQL editor for other environments, then: NOTIFY pgrst, 'reload schema';

CREATE TABLE IF NOT EXISTS auto_sell_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  -- mc_milestone | pct_gain | time_elapsed | stop_loss_mc | trailing_stop
  trigger_type text NOT NULL,
  -- { targetMcUsd | gainPct | minutes | mcUsd | trailPct }
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sell_pct numeric NOT NULL DEFAULT 100,        -- 1..100
  token_scope jsonb NOT NULL DEFAULT '{"kind":"all_held"}'::jsonb, -- {kind:'mint'|'all_held', mint?}
  wallet_scope text NOT NULL DEFAULT 'primary',
  cooldown_seconds integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auto_sell_rules_user_active_idx ON auto_sell_rules (user_id, is_active);

-- Deny-by-default: RLS on with no policies; the app reads/writes via the service role.
ALTER TABLE auto_sell_rules ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
