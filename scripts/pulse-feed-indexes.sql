-- Pulse feed query indexes — run AFTER scripts/pulse-migration-run-now.sql
-- (bonding_progress column must exist before tokens_bonding_progress_idx)

CREATE INDEX IF NOT EXISTS tokens_created_at_idx ON tokens (created_at DESC);

CREATE INDEX IF NOT EXISTS tokens_migrated_at_idx ON tokens (migrated_at DESC)
  WHERE migrated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS tokens_bonding_progress_idx ON tokens (bonding_progress DESC)
  WHERE migrated_at IS NULL;

CREATE INDEX IF NOT EXISTS tokens_launch_pad_idx ON tokens (launch_pad);
