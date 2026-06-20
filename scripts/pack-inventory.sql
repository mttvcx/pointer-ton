-- Packs v1 (real commerce) — pack-acquired token inventory + purchase payments.
-- Tokens won from packs are tracked in pack_inventory so that SELLING them
-- charges the elevated pack fee (2%) and earns NO cashback, while the same mint
-- bought normally still trades at the standard fee. pack_payments records the
-- on-chain SOL transfer that funds each open (idempotency guard). Run in the
-- Supabase SQL editor, then scripts/reload-postgrest-schema.sql.

CREATE TABLE IF NOT EXISTS pack_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mint text NOT NULL,
  open_id uuid,                              -- pack open that granted it
  reward_id text,
  amount_raw text NOT NULL,                  -- token base units credited (integer string)
  amount_remaining_raw text NOT NULL,        -- decremented as the user sells (integer string)
  acquired_tx text,                          -- on-chain buy/transfer signature
  status text NOT NULL DEFAULT 'held',       -- held | partial | sold
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pack_inventory_user_mint
  ON pack_inventory (user_id, mint)
  WHERE status <> 'sold';

-- Pack purchase payments — one verified on-chain SOL transfer per pack open.
-- The UNIQUE(payment_tx) constraint is the idempotency guard: a replayed
-- signature cannot open a second pack or double-fulfill rewards.
CREATE TABLE IF NOT EXISTS pack_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_tx text NOT NULL UNIQUE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  pack_type text NOT NULL,
  amount_lamports numeric NOT NULL,
  open_id uuid,
  status text NOT NULL DEFAULT 'verified',   -- verified | fulfilled | refunded | failed
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

NOTIFY pgrst, 'reload schema';
