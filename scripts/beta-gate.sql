-- Beta access: single-use codes; founder generates via API. Run in Supabase SQL editor.

ALTER TABLE users ADD COLUMN IF NOT EXISTS beta_granted_at timestamptz;

CREATE TABLE IF NOT EXISTS beta_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  code_hash text NOT NULL UNIQUE,
  created_by_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  used_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_codes_created_by ON beta_codes (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_beta_codes_used_by ON beta_codes (used_by_user_id);
