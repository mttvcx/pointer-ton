-- =============================================================================
-- RUN THIS ENTIRE FILE IN SUPABASE SQL EDITOR (in order — one paste, one Run)
-- Fixes: STRETCH column "bonding_progress does not exist" + feed query indexes
-- =============================================================================

-- Step 1: Add Phase 2 columns (required before any bonding_progress index)
ALTER TABLE tokens
  ADD COLUMN IF NOT EXISTS bonding_progress double precision,
  ADD COLUMN IF NOT EXISTS migrated_to text;

COMMENT ON COLUMN tokens.bonding_progress IS 'Bonding curve fill % (0-100). Updated on webhook ingest.';
COMMENT ON COLUMN tokens.migrated_to IS 'Migration destination: pumpswap | raydium | meteora';

-- Step 2: Column-specific indexes (safe after Step 1)
CREATE INDEX IF NOT EXISTS idx_tokens_stretch_column
  ON tokens (bonding_progress DESC, created_at DESC)
  WHERE migrated_at IS NULL AND bonding_progress IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tokens_migrated_column
  ON tokens (migrated_at DESC)
  WHERE migrated_at IS NOT NULL;

-- Step 3: General feed performance indexes
CREATE INDEX IF NOT EXISTS tokens_created_at_idx ON tokens (created_at DESC);

CREATE INDEX IF NOT EXISTS tokens_migrated_at_idx ON tokens (migrated_at DESC)
  WHERE migrated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS tokens_bonding_progress_idx ON tokens (bonding_progress DESC)
  WHERE migrated_at IS NULL;

CREATE INDEX IF NOT EXISTS tokens_launch_pad_idx ON tokens (launch_pad);
