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
