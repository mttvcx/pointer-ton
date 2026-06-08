-- tracked_wallets: required for PostgREST upsert onConflict user_id,wallet_address
-- (lib/db/wallets.ts upsertTrackedWallet). Run in Supabase SQL editor, then reload PostgREST schema.

-- Remove exact duplicates before adding the constraint (keep oldest row per user+wallet).
DELETE FROM tracked_wallets a
USING tracked_wallets b
WHERE a.user_id = b.user_id
  AND a.wallet_address = b.wallet_address
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS tracked_wallets_user_wallet_uidx
  ON tracked_wallets (user_id, wallet_address);

NOTIFY pgrst, 'reload schema';
