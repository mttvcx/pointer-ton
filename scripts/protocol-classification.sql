-- Protocol classification columns (P0). Run in Supabase SQL editor, then reload PostgREST schema.
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS protocol_id TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS protocol_family TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS chain_id TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS token_kind TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS launch_type TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS migration_state TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS dex_id TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS classification_source TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS source_confidence NUMERIC(4, 3);
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS classification_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS tokens_protocol_id_idx ON tokens (protocol_id);
CREATE INDEX IF NOT EXISTS tokens_chain_protocol_idx ON tokens (chain_id, protocol_id);
CREATE INDEX IF NOT EXISTS tokens_token_kind_idx ON tokens (token_kind);
CREATE INDEX IF NOT EXISTS tokens_migration_state_idx ON tokens (migration_state);
