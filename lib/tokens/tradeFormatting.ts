import type { WalletIntelBadgeKind } from '@/lib/walletIdentity/types';
import { demoWalletAt } from '@/lib/dev/demoTokenFixtures';
import { formatCompactUsd } from '@/lib/format';
import { tradeRowEventKind } from '@/lib/indexer/parseSwapFromEnhancedTx';
import type { MintSwapEventKind } from '@/lib/indexer/types';
import type { Tables } from '@/lib/supabase/types';
import { shortenAddress } from '@/lib/utils/addresses';

type TradeRow = Tables<'trades'> & {
  chain_wallet?: string | null;
  event_kind?: MintSwapEventKind | string | null;
  market_cap_usd_at_fill?: number | null;
  desk_badges?: WalletIntelBadgeKind[];
};

function demoTradeIndexFromRow(t: TradeRow): number | null {
  const m = String(t.id).match(/^demo-tx-(\d+)$/);
  return m ? Number(m[1]) : null;
}

/** Demo desk flags so Trades trader cells show the same badge icons as Holders. */
export function tradeWalletDeskExtras(
  wallet: string,
  demoIdx: number | null,
  creatorWallet: string | null,
  chainBadges?: WalletIntelBadgeKind[] | null,
): {
  isDev: boolean;
  isSniper: boolean;
  isFresh: boolean;
  inlineBadges: WalletIntelBadgeKind[];
} {
  const inlineBadges: WalletIntelBadgeKind[] = [...(chainBadges ?? [])];
  if (demoIdx != null) {
    if (demoIdx % 8 === 5 && !inlineBadges.includes('kol')) inlineBadges.push('kol');
    else if (demoIdx % 6 === 1 && !inlineBadges.includes('whale')) inlineBadges.push('whale');
    else if (demoIdx % 4 === 0 && !inlineBadges.includes('top_trader')) inlineBadges.push('top_trader');
  }
  const isDev =
    inlineBadges.includes('dev') ||
    Boolean(creatorWallet && creatorWallet === wallet) ||
    demoIdx === 0;
  const isSniper =
    inlineBadges.includes('sniper') ||
    wallet === demoWalletAt(3) ||
    wallet === demoWalletAt(8) ||
    demoIdx === 3 ||
    demoIdx === 8;
  const isFresh = inlineBadges.includes('fresh');
  return {
    isDev,
    isSniper,
    isFresh,
    inlineBadges,
  };
}

export function tradeRowEventKindFromRow(t: TradeRow): MintSwapEventKind {
  return tradeRowEventKind(t);
}

/** MC column label — REMOVE for liquidity events (Axiom parity). */
export function tradeMcColumnLabel(
  t: TradeRow,
  supplyTokens: number | null | undefined,
  fallbackMcUsd?: number | null,
): string {
  const kind = tradeRowEventKindFromRow(t);
  if (kind === 'remove_liq') return 'REMOVE';
  if (kind === 'add_liq') return 'ADD';

  const stored = t.market_cap_usd_at_fill;
  if (stored != null && Number.isFinite(stored) && stored > 0) {
    return formatCompactUsd(stored);
  }
  return tradeFillMarketCapUsdLabel(t, supplyTokens, fallbackMcUsd);
}

export function tradeIsLiquidityEvent(t: TradeRow): boolean {
  const k = tradeRowEventKindFromRow(t);
  return k === 'remove_liq' || k === 'add_liq';
}

/** Default desk tape / trades table — buy/sell only. */
export function tradeIsDeskSwap(t: TradeRow): boolean {
  return !tradeIsLiquidityEvent(t);
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

/** Resolve maker wallet for filtering (demo + chain indexer). */
export function tradeMakerWallet(t: TradeRow, rowIndex: number): string | null {
  const chain = t.chain_wallet?.trim();
  if (chain) return chain;

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

/** Market cap at print (price × circulating supply). */
export function tradeFillMarketCapUsdLabel(
  t: TradeRow,
  supplyTokens: number | null | undefined,
  fallbackMcUsd?: number | null,
): string {
  const px = t.price_usd_at_fill;
  if (px == null || !Number.isFinite(px)) return '\u2014';
  if (supplyTokens != null && supplyTokens > 0) {
    return formatCompactUsd(px * supplyTokens);
  }
  if (fallbackMcUsd != null && Number.isFinite(fallbackMcUsd)) {
    return formatCompactUsd(fallbackMcUsd);
  }
  return '\u2014';
}

export type TradeTraderHint = {
  shortLabel: string;
  fullAddress: string | null;
  tradeCountForMint: number | null;
};

export function tradeTraderHint(t: TradeRow, rowIndex: number): TradeTraderHint {
  const chainWallet = t.chain_wallet?.trim();
  if (chainWallet) {
    return {
      shortLabel: chainWallet.length >= 3 ? chainWallet.slice(-3) : chainWallet,
      fullAddress: chainWallet,
      tradeCountForMint: null,
    };
  }

  const demoIdx = demoTradeIndexFromRow(t);
  if (demoIdx != null) {
    const w = demoTradeMakerWallet(demoIdx);
    return {
      shortLabel: w.length >= 3 ? w.slice(-3) : w,
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
