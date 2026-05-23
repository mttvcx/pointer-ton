import type { WalletIntelBadgeKind } from '@/lib/walletIdentity/types';
import { demoWalletAt } from '@/lib/dev/demoTokenFixtures';
import { formatCompactUsd } from '@/lib/format';
import type { Tables } from '@/lib/supabase/types';
import { shortenAddress } from '@/lib/utils/addresses';

type TradeRow = Tables<'trades'>;

function demoTradeIndexFromRow(t: TradeRow): number | null {
  const m = String(t.id).match(/^demo-tx-(\d+)$/);
  return m ? Number(m[1]) : null;
}

/** Demo desk flags so Trades trader cells show the same badge icons as Holders. */
export function tradeWalletDeskExtras(
  wallet: string,
  demoIdx: number | null,
  creatorWallet: string | null,
): {
  isDev: boolean;
  isSniper: boolean;
  inlineBadges: WalletIntelBadgeKind[];
} {
  const inlineBadges: WalletIntelBadgeKind[] = [];
  if (demoIdx != null) {
    if (demoIdx % 8 === 5) inlineBadges.push('kol');
    else if (demoIdx % 6 === 1) inlineBadges.push('whale');
    else if (demoIdx % 4 === 0) inlineBadges.push('top_trader');
  }
  return {
    isDev: Boolean(creatorWallet && creatorWallet === wallet) || demoIdx === 0,
    isSniper:
      wallet === demoWalletAt(3) ||
      wallet === demoWalletAt(8) ||
      demoIdx === 3 ||
      demoIdx === 8,
    inlineBadges,
  };
}

export function tradeRowDemoIndex(t: TradeRow): number | null {
  return demoTradeIndexFromRow(t);
}

export type TradesDeskFilter = 'all' | 'dev' | 'tracked' | 'you';

export function tradeRowMatchesDeskFilter(params: {
  wallet: string | null;
  creatorWallet: string | null;
  tracked: boolean;
  userWallet: string | null;
  filter: TradesDeskFilter;
}): boolean {
  const { wallet, creatorWallet, tracked, userWallet, filter } = params;
  if (filter === 'all') return true;
  if (!wallet) return false;
  switch (filter) {
    case 'dev':
      return Boolean(creatorWallet && creatorWallet === wallet);
    case 'tracked':
      return tracked;
    case 'you':
      return Boolean(userWallet && userWallet === wallet);
    default:
      return true;
  }
}

/** Demo trades cycle through the same wallet pool as top-traders rows. */
export function demoTradeMakerWallet(rowIndex: number): string {
  return demoWalletAt(rowIndex % 24);
}

/** Resolve maker wallet for filtering (demo + future API fields). */
export function tradeMakerWallet(t: TradeRow, rowIndex: number): string | null {
  const demoIdx = demoTradeIndexFromRow(t);
  if (demoIdx != null) {
    return demoTradeMakerWallet(demoIdx);
  }
  return null;
}

/** USD notional at print (price × size). */
export function tradeFillMcUsdLabel(t: TradeRow): string {
  const px = t.price_usd_at_fill;
  const amt = t.amount_token;
  if (px == null || amt == null || !Number.isFinite(px) || !Number.isFinite(amt)) return '\u2014';
  const v = px * amt;
  if (!Number.isFinite(v) || v === 0) return '\u2014';
  return formatCompactUsd(v);
}

export type TradeTraderHint = {
  shortLabel: string;
  fullAddress: string | null;
  tradeCountForMint: number | null;
};

export function tradeTraderHint(t: TradeRow, rowIndex: number): TradeTraderHint {
  const demoIdx = demoTradeIndexFromRow(t);
  if (demoIdx != null) {
    const w = demoTradeMakerWallet(demoIdx);
    return {
      shortLabel: `${w.slice(0, 4)}\u2026${w.slice(-4)}`,
      fullAddress: w,
      tradeCountForMint: 1 + (demoIdx % 7),
    };
  }
  const sig = t.tx_signature;
  if (sig.length >= 12) {
    return {
      shortLabel: `${sig.slice(0, 4)}\u2026${sig.slice(-4)}`,
      fullAddress: null,
      tradeCountForMint: null,
    };
  }
  return {
    shortLabel: shortenAddress(String(t.user_id), 4),
    fullAddress: null,
    tradeCountForMint: null,
  };
}
