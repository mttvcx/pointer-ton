import type { AppChainId } from '@/lib/chains/appChain';

export type IdentityAddressType = 'solana' | 'evm';

export type IdentityImportType = 'api' | 'scrape' | 'manual_json' | 'manual_csv';

export type IdentityStatsPeriod = '1d' | '7d' | '30d' | 'all';

export type IdentityBadgeKind =
  | 'KOL'
  | 'Smart Money'
  | 'Whale'
  | 'Sniper'
  | 'Fresh Wallet'
  | 'Insider'
  | 'Dev'
  | 'Team'
  | 'Fund'
  | 'Market Maker'
  | 'Builder'
  | 'Verified'
  | 'Pointer Verified'
  | 'PTCS Qualified';

export type IdentityPrimaryCategory =
  | 'kol'
  | 'smart_money'
  | 'whale'
  | 'sniper'
  | 'insider'
  | 'dev'
  | 'fund'
  | 'market_maker'
  | 'other';

export type IdentitySourceName = 'kolscan' | 'gmgn' | 'manual' | 'pointer' | string;

/** Curated import row (seed JSON / CSV / API adapters). */
export type IdentitySeedRow = {
  chain: AppChainId | 'solana' | 'ethereum' | 'bsc' | 'base';
  address: string;
  displayName: string;
  avatarUrl?: string | null;
  twitterHandle?: string | null;
  telegramHandle?: string | null;
  websiteUrl?: string | null;
  category?: IdentityPrimaryCategory;
  badges?: IdentityBadgeKind[];
  source: IdentitySourceName;
  sourceUrl?: string | null;
  confidence?: number;
  verified?: boolean;
  rank?: number | null;
  pnlUsd?: number | null;
  pnlPct?: number | null;
  winRate?: number | null;
  txCount?: number | null;
  buyCount?: number | null;
  sellCount?: number | null;
  volumeUsd?: number | null;
  trackedCount?: number | null;
  renamedCount?: number | null;
  notes?: string | null;
};

export type IdentityProfile = {
  id: string;
  displayName: string;
  normalizedDisplayName: string;
  avatarUrl: string | null;
  twitterHandle: string | null;
  telegramHandle: string | null;
  websiteUrl: string | null;
  notes: string | null;
  primaryCategory: IdentityPrimaryCategory;
  badges: IdentityBadgeKind[];
  verified: boolean;
  sourcePriority: number;
  createdAt: string;
  updatedAt: string;
};

export type IdentityWallet = {
  id: string;
  identityId: string;
  chain: AppChainId;
  address: string;
  normalizedAddress: string;
  addressType: IdentityAddressType;
  label: string | null;
  source: IdentitySourceName;
  sourceUrl: string | null;
  confidence: number;
  verified: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type IdentitySource = {
  id: string;
  sourceName: IdentitySourceName;
  sourceUrl: string | null;
  chain: AppChainId | null;
  importType: IdentityImportType;
  enabled: boolean;
  lastImportedAt: string | null;
  lastImportStatus: string | null;
  lastImportCount: number;
  error: string | null;
};

export type IdentityStatsSnapshot = {
  id: string;
  identityId: string;
  walletId: string;
  chain: AppChainId;
  period: IdentityStatsPeriod;
  pnlUsd: number | null;
  pnlPct: number | null;
  winRate: number | null;
  txCount: number | null;
  buyCount: number | null;
  sellCount: number | null;
  volumeUsd: number | null;
  trackedCount: number | null;
  renamedCount: number | null;
  rank: number | null;
  source: IdentitySourceName;
  capturedAt: string;
};

export type TradeIdentityEvent = {
  id: string;
  chain: AppChainId;
  tokenAddress: string;
  walletAddress: string;
  identityId: string | null;
  side: 'buy' | 'sell';
  timestamp: string;
  priceUsd: number | null;
  amountUsd: number | null;
  amountToken: number | null;
  txHash: string | null;
  pnlAfter: number | null;
  source: IdentitySourceName | 'trades';
  avatarUrl: string | null;
  displayName: string | null;
  badges: IdentityBadgeKind[];
};

export type ResolvedWalletIdentity = {
  address: string;
  chain: AppChainId;
  normalizedAddress: string;
  shortAddress: string;
  displayName: string;
  avatarUrl: string | null;
  twitterHandle: string | null;
  telegramHandle: string | null;
  badges: IdentityBadgeKind[];
  primaryCategory: IdentityPrimaryCategory | null;
  source: IdentitySourceName | null;
  sourceUrl: string | null;
  sourceLabel: string;
  verified: boolean;
  manualOverride: boolean;
  confidence: number | null;
  identityId: string | null;
  stats30d: IdentityStatsSnapshot | null;
};

export type IdentityDuplicateFlag = {
  kind: 'wallet' | 'display_name' | 'twitter' | 'avatar';
  message: string;
  keys: string[];
};
