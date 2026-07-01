/**
 * Shared response shapes for `/api/ext/*`. These MIRROR the ext-facade endpoints
 * in pointer-ton (Phase 1) — the extension never invents fields. Marked partial
 * because the facade returns what it can verify; the UI degrades gracefully.
 */

/** Universal on-page label — Pointer's KOL/identity directory or the user's own. */
export interface ExtLabel {
  name: string;
  badge: string | null;
  verified: boolean;
  kind: 'kol' | 'personal' | 'community';
}
export interface ExtLabels {
  handles: Record<string, ExtLabel>;
  wallets: Record<string, ExtLabel>;
}

export interface ExtMe {
  connected: boolean;
  userId: string | null;
  email: string | null;
  username: string | null;
  subscription: 'none' | 'active' | 'founder';
  aiAccess: boolean; // ≥5 SOL OR subscription
  referralCode: string | null;
  solBalance: number | null;
  monthlyVolumeSol: number | null;
  scansRemaining: number | null;
}

export interface TokenIntel {
  mint: string;
  symbol: string | null;
  name: string | null;
  iconUrl: string | null;
  priceUsd: number | null;
  change24hPct: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  ageDays: number | null;
  holderCount: number | null;
  top10Pct: number | null;
  bundlersPct: number | null;
  snipersPct: number | null;
  smartMoney: { label: string; pct: number | null }[];
  creator: { wallet: string | null; priorLaunches: number | null; rugged: number | null };
  aiSummary: string | null;
}

export interface WalletIntel {
  address: string;
  netWorthUsd: number | null;
  realizedPnlUsd: number | null;
  unrealizedPnlUsd: number | null;
  favoriteEcosystem: string | null;
  avgHoldHours: number | null;
  behavior: string | null;
  labels: string[];
  aliases: string[];
  recentBuys: { mint: string; symbol: string | null }[];
  recentSells: { mint: string; symbol: string | null }[];
  aiSummary: string | null;
  /** Real cumulative realized-PnL curve from indexed swaps (t = epoch ms, v = USD). */
  chart?: { t: number; v: number }[];
}

/** Fast realized-PnL read (from indexed swaps). `indexing` = backfill in progress. */
export interface WalletPnl {
  realizedPnlUsd: number | null;
  chart: { t: number; v: number }[];
  indexing: boolean;
}

export interface ProfileIntel {
  handle: string;
  name: string | null;
  bio: string | null;
  wallets: { address: string; chain: 'sol' | 'evm'; verified: boolean; label?: string }[];
  ethos: { score: number | null; reviews: number | null } | null;
  smartFollowers: number | null;
  notableFollowers: { handle: string; role: string | null }[];
  labels: string[];
  usernameHistory: string[];
  aiSummary: string | null;
}
