-- Pointer Financial — per-user capital-layer account (Bridge customer + card).
-- One row per user once they activate the financial layer. Inert until this runs:
-- lib/financial/db.ts swallows reads/writes while the table is absent.
-- Run in Supabase SQL editor, then scripts/reload-postgrest-schema.sql.

CREATE TABLE IF NOT EXISTS financial_accounts (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bridge_customer_id text,               -- provider customer id (Bridge)
  bridge_card_id text,                   -- issued card id
  card_last4 text,
  card_state text DEFAULT 'virtual',     -- virtual | physical | frozen
  kyc_tier int DEFAULT 1,                -- 0 none · 1 lite (name+country) · 2 full
  card_in_wallet boolean DEFAULT false,  -- provisioned to Apple Pay
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

NOTIFY pgrst, 'reload schema';
