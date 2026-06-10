import type { TradeSide } from '@/lib/supabase/types';

export type MintSwapEventKind = 'swap' | 'remove_liq' | 'add_liq';

export type ParsedMintSwap = {
  mint: string;
  signature: string;
  wallet: string;
  eventKind: MintSwapEventKind;
  side: TradeSide;
  tokenAmountRaw: number;
  tokenAmountUi: number;
  solAmount: number;
  usdAmount: number | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  blockTime: string;
  slot: number | null;
  programId: string | null;
  poolAddress: string | null;
  source: string;
};

export type IndexerAddressTarget = {
  address: string;
  kind: 'dex_pair' | 'bonding_curve' | 'canonical_pool' | 'mint';
  reason: string;
};

export type BackfillReport = {
  mint: string;
  dryRun: boolean;
  targets: IndexerAddressTarget[];
  signaturesFetched: number;
  transactionsParsed: number;
  swapsParsed: number;
  swapsInserted: number;
  swapsSkippedDuplicate: number;
  parserFailures: number;
  failureSamples: string[];
  walletsDerived: number;
  topTraderCount: number;
  heliusCalls: number;
  creditsEstimated: number;
};

/** Desk trade shape — extends Pointer trades with chain wallet. */
export type ChainDeskTrade = {
  id: string;
  user_id: string;
  mint: string;
  side: TradeSide;
  amount_in_raw: string;
  amount_out_raw: string;
  amount_sol: number | null;
  amount_token: number | null;
  price_usd_at_fill: number | null;
  tx_signature: string;
  fee_paid_lamports: number | null;
  platform_fee_lamports: number | null;
  priority_fee_lamports: number | null;
  jito_tip_lamports: number | null;
  status: 'confirmed';
  failure_reason: string | null;
  submitted_at: string;
  confirmed_at: string | null;
  chain_wallet: string;
  /** Alias for identity / activity strip hydration. */
  wallet_address: string;
  source: 'chain_indexer';
  event_kind: MintSwapEventKind;
  /** MC at fill from indexer — preferred over price×supply for desk MC column. */
  market_cap_usd_at_fill: number | null;
  /** Chain-derived wallet badges for desk rows. */
  desk_badges?: import('@/lib/walletIdentity/types').WalletIntelBadgeKind[];
};
