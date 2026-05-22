-- Pulse token column state: bonding curve % + migration destination.
-- Run in Supabase SQL editor before deploying Phase 1+2 Pulse webhook ingest.

ALTER TABLE tokens
  ADD COLUMN IF NOT EXISTS bonding_progress double precision,
  ADD COLUMN IF NOT EXISTS migrated_to text;

COMMENT ON COLUMN tokens.bonding_progress IS 'Bonding curve fill % (0-100). Updated on webhook ingest.';
COMMENT ON COLUMN tokens.migrated_to IS 'Migration destination: pumpswap | raydium | meteora';

CREATE INDEX IF NOT EXISTS idx_tokens_stretch_column
  ON tokens (bonding_progress DESC, created_at DESC)
  WHERE migrated_at IS NULL AND bonding_progress IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tokens_migrated_column
  ON tokens (migrated_at DESC)
  WHERE migrated_at IS NOT NULL;
