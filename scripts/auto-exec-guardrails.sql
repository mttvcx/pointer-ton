-- Layer C substrate: delegated auto-execution guardrails. INERT until the engine
-- is enabled (POINTER_AUTO_EXEC_ENABLED=1) AND a Privy signer is implemented in
-- lib/autoExec/privySigner.ts — both gated + fail-closed. Applied to prod
-- (ajngsbnwtkmkvbgpntkd) via Supabase MCP migration `auto_exec_guardrails`.

CREATE TABLE IF NOT EXISTS session_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  chain_type text NOT NULL DEFAULT 'solana',
  status text NOT NULL DEFAULT 'active',          -- active | revoked
  privy_key_quorum_id text,
  policy_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (user_id, wallet_address, chain_type)
);
CREATE INDEX IF NOT EXISTS session_signers_user_idx ON session_signers (user_id, status);
ALTER TABLE session_signers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS auto_exec_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id uuid,
  kind text NOT NULL,                             -- buy | sell
  mint text,
  amount_sol numeric NOT NULL DEFAULT 0,
  status text NOT NULL,                           -- reserved | signed | confirmed | failed | dry_run | denied
  reason text,
  signature text,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
CREATE INDEX IF NOT EXISTS auto_exec_ledger_rule_day_idx ON auto_exec_ledger (rule_id, created_at);
CREATE INDEX IF NOT EXISTS auto_exec_ledger_user_idx ON auto_exec_ledger (user_id, created_at);
ALTER TABLE auto_exec_ledger ENABLE ROW LEVEL SECURITY;

-- Atomic per-rule reservation under an advisory xact lock: per-trade max, cooldown,
-- daily cap all checked + the row inserted in one serialized critical section, so a
-- burst of concurrent fires can never exceed the daily cap. Returns ledger id or NULL.
CREATE OR REPLACE FUNCTION reserve_auto_exec(
  p_user_id uuid, p_rule_id uuid, p_kind text, p_mint text,
  p_amount_sol numeric, p_daily_cap_sol numeric, p_per_trade_max_sol numeric, p_cooldown_seconds integer
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE v_spent numeric; v_last timestamptz; v_id uuid;
BEGIN
  IF p_per_trade_max_sol IS NOT NULL AND p_amount_sol > p_per_trade_max_sol THEN
    INSERT INTO auto_exec_ledger(user_id, rule_id, kind, mint, amount_sol, status, reason)
      VALUES (p_user_id, p_rule_id, p_kind, p_mint, p_amount_sol, 'denied', 'per_trade_max');
    RETURN NULL;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(COALESCE(p_rule_id::text, p_user_id::text)));
  SELECT max(created_at) INTO v_last FROM auto_exec_ledger
    WHERE rule_id = p_rule_id AND status IN ('reserved','signed','confirmed');
  IF p_cooldown_seconds > 0 AND v_last IS NOT NULL
     AND now() - v_last < make_interval(secs => p_cooldown_seconds) THEN
    INSERT INTO auto_exec_ledger(user_id, rule_id, kind, mint, amount_sol, status, reason)
      VALUES (p_user_id, p_rule_id, p_kind, p_mint, p_amount_sol, 'denied', 'cooldown');
    RETURN NULL;
  END IF;
  SELECT COALESCE(sum(amount_sol),0) INTO v_spent FROM auto_exec_ledger
    WHERE rule_id = p_rule_id AND status IN ('reserved','signed','confirmed')
      AND created_at >= date_trunc('day', now());
  IF p_daily_cap_sol IS NOT NULL AND v_spent + p_amount_sol > p_daily_cap_sol THEN
    INSERT INTO auto_exec_ledger(user_id, rule_id, kind, mint, amount_sol, status, reason)
      VALUES (p_user_id, p_rule_id, p_kind, p_mint, p_amount_sol, 'denied', 'daily_cap');
    RETURN NULL;
  END IF;
  INSERT INTO auto_exec_ledger(user_id, rule_id, kind, mint, amount_sol, status)
    VALUES (p_user_id, p_rule_id, p_kind, p_mint, p_amount_sol, 'reserved')
    RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION reserve_auto_exec(uuid,uuid,text,text,numeric,numeric,numeric,integer) FROM public, anon, authenticated;

NOTIFY pgrst, 'reload schema';
