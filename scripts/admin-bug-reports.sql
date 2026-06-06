-- Admin v1 — persisted bug reports (previously webhook-only).
-- Run in Supabase SQL editor, then scripts/reload-postgrest-schema.sql.

CREATE TABLE IF NOT EXISTS bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL,
  description text NOT NULL,
  route text,
  active_chain text,
  mint_hint text,
  wallet_masked text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'new',   -- new | triaged | resolved | spam
  triaged_by uuid REFERENCES users(id),
  triaged_at timestamptz,
  delivered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports (status, created_at DESC);

NOTIFY pgrst, 'reload schema';
