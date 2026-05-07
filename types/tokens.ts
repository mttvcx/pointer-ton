import type { Tables } from '@/lib/supabase/types';

export type TokenRow = Tables<'tokens'>;
export type TokenMarketSnapshotRow = Tables<'token_market_snapshots'>;
export type TokenHolderRow = Tables<'token_holders'>;

export type PulseTokenBundle = {
  token: TokenRow;
  snapshot: TokenMarketSnapshotRow | null;
};
