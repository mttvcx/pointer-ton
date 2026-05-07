-- Phase 4 Step 10: mark imported (Privy importWallet) rows; trading APIs reject is_imported.
alter table user_wallets add column if not exists is_imported boolean not null default false;

notify pgrst, 'reload schema';
