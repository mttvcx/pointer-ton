-- Admin v1 — runtime feature flags.
-- Run in Supabase SQL editor, then scripts/reload-postgrest-schema.sql.

CREATE TABLE IF NOT EXISTS feature_flags (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT 'false'::jsonb,
  description text,
  -- When false, writes are blocked in production (dev-only flag). The control
  -- room refuses to toggle these in prod unless allow_prod is set true.
  allow_prod boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

NOTIFY pgrst, 'reload schema';
