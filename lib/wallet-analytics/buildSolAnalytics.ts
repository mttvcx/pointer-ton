import 'server-only';

import { getTokensByMints } from '@/lib/db/tokens';
import type { WalletStatsRow } from '@/lib/db/wallets';
import { listAllSwapsForWallet, type MintSwapRow } from '@/lib/db/mintSwaps';
import { deriveWalletStatsFromSwaps } from '@/lib/indexer/deriveWalletStats';
import { fetchUsdPricesForMints } from '@/lib/jupiter/priceTickers';
import { getSolBalanceLamports } from '@/lib/solana/recent-activity';
import { findRecentIncomingSolFunding } from '@/lib/solana/walletFunding';
import { listNonZeroSplBalances } from '@/lib/solana/wallet-token-balances';
import { SOL_MINT } from '@/lib/utils/addresses';
import { isPortfolioFundingAsset } from '@/lib/portfolio/tradePositions';
import { lamportsToSol } from '@/lib/utils/formatters';
import type { WalletFundingInfo } from '@/lib/wallet-analytics/types';
import type {
  WalletAnalyticsChartPoint,
  WalletAnalyticsTimeframe,
  WalletPositionRow,
  WinLossBucket,
} from '@/lib/wallet-analytics/types';
import type { WalletAnalyticsPayload } from '@/lib/wallet-analytics/types';

const WSOL_MINT = 'So11111111111111111111111111111111111111112';
/** Cap the rendered positions list (Axiom shows ~top-30; we keep a little headroom). */
const MAX_POSITIONS = 50;
/** Drop dust/spam rows below this combined relevance ($). */
const DUST_USD = 1;

export function pickTimeframePnlUsd(
  stats: WalletStatsRow | null,
  tf: WalletAnalyticsTimeframe,
): number | null {
  if (!stats) return null;
  switch (tf) {
    case '1d':
      return stats.pnl_usd_24h;
    case '7d':
      return stats.pnl_usd_7d;
    case '30d':
    case 'max':
      return stats.pnl_usd_30d;
    default:
      return stats.pnl_usd_30d;
  }
}

/** Kept for compatibility (TON path); the live curve is built inline from swaps. */
export function buildChartSeries(
  _walletAddress?: string,
  _stats?: WalletStatsRow | null,
  _tf?: WalletAnalyticsTimeframe,
): WalletAnalyticsChartPoint[] {
  return [];
}

const CURVE_EPS = 1e-9;
const CURVE_MAX_POINTS = 48;

/**
 * Real cumulative realized-PnL curve for the whole wallet, from indexed swaps.
 * Per-mint FIFO lot matching (same logic as deriveWalletStatsFromSwaps) emits a
 * realized delta at each sell; deltas are merged across mints in time order and
 * accumulated. Honest — every point is a real realized event, never synthetic.
 */
function realizedPnlCurve(byMint: Map<string, MintSwapRow[]>): WalletAnalyticsChartPoint[] {
  const events: { t: number; d: number }[] = [];
  for (const rows of byMint.values()) {
    const sorted = rows
      .filter((r) => !r.event_kind || r.event_kind === 'swap')
      .slice()
      .sort((a, b) => a.block_time.localeCompare(b.block_time));
    const lots: { qty: number; unitUsd: number }[] = [];
    for (const r of sorted) {
      const qty = r.token_amount_ui;
      const px =
        r.price_usd != null && r.price_usd > 0
          ? r.price_usd
          : r.usd_amount != null && qty > 0
            ? r.usd_amount / qty
            : 0;
      if (px <= 0 || qty <= CURVE_EPS) continue;
      if (r.side === 'buy') {
        lots.push({ qty, unitUsd: px });
        continue;
      }
      let sellLeft = qty;
      let cost = 0;
      while (sellLeft > CURVE_EPS && lots.length > 0) {
        const lot = lots[0]!;
        const take = Math.min(sellLeft, lot.qty);
        cost += take * lot.unitUsd;
        lot.qty -= take;
        sellLeft -= take;
        if (lot.qty <= CURVE_EPS) lots.shift();
      }
      const t = Date.parse(r.block_time);
      if (Number.isFinite(t)) events.push({ t, d: qty * px - cost });
    }
  }
  if (events.length === 0) return [];
  events.sort((a, b) => a.t - b.t);
  let cum = 0;
  let pts: WalletAnalyticsChartPoint[] = events.map((e) => {
    cum += e.d;
    return { t: e.t, v: Math.round(cum) };
  });
  if (pts.length > CURVE_MAX_POINTS) {
    const step = (pts.length - 1) / (CURVE_MAX_POINTS - 1);
    const sampled: WalletAnalyticsChartPoint[] = [];
    for (let i = 0; i < CURVE_MAX_POINTS; i++) sampled.push(pts[Math.round(i * step)]!);
    pts = sampled;
  }
  return pts;
}

/**
 * Win/loss totals from a stats row (TON path / fallback). win_rate_30d is a
 * 0-1 fraction, so multiply by trades directly (the historic /100 produced ~0).
 */
export function buildWinLossBuckets(
  _walletAddress: string,
  stats: WalletStatsRow | null,
): WinLossBucket[] {
  const trades = stats?.trades_30d;
  const winRate = stats?.win_rate_30d;
  if (
    trades == null ||
    winRate == null ||
    !Number.isFinite(trades) ||
    !Number.isFinite(winRate) ||
    trades <= 0
  ) {
    return [];
  }
  const wins = Math.max(0, Math.round(trades * Math.min(1, Math.max(0, winRate))));
  const losses = Math.max(0, Math.round(trades) - wins);
  return [
    { id: 'wins', label: 'Wins (30d)', count: wins, tone: 'bull' },
    { id: 'losses', label: 'Losses (30d)', count: losses, tone: 'bear' },
  ];
}

function timeframeSinceMs(tf: WalletAnalyticsTimeframe): number | null {
  if (tf === '1d') return Date.now() - 86_400_000;
  if (tf === '7d') return Date.now() - 7 * 86_400_000;
  if (tf === '30d') return Date.now() - 30 * 86_400_000;
  return null; // 'max' → all indexed history
}

function relTimeLabel(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Axiom-style realized-PnL %-band distribution across the wallet's traded mints. */
function buildPnlBuckets(pnlPctByMint: number[]): WinLossBucket[] {
  if (pnlPctByMint.length === 0) return [];
  let gt500 = 0;
  let mid = 0;
  let low = 0;
  let down = 0;
  let deep = 0;
  for (const p of pnlPctByMint) {
    if (p > 500) gt500 += 1;
    else if (p > 200) mid += 1;
    else if (p >= 0) low += 1;
    else if (p >= -50) down += 1;
    else deep += 1;
  }
  return [
    { id: 'gt500', label: '>500%', count: gt500, tone: 'bull' },
    { id: '200to500', label: '200% ~ 500%', count: mid, tone: 'bull' },
    { id: '0to200', label: '0% ~ 200%', count: low, tone: 'bull' },
    { id: '0toNeg50', label: '0% ~ -50%', count: down, tone: 'bear' },
    { id: 'ltNeg50', label: '< -50%', count: deep, tone: 'bear' },
  ];
}

export async function buildSolWalletAnalytics(params: {
  address: string;
  timeframe: WalletAnalyticsTimeframe;
  stats: WalletStatsRow | null;
}): Promise<WalletAnalyticsPayload> {
  const { address, timeframe, stats } = params;
  const sinceMs = timeframeSinceMs(timeframe);
  const sinceIso = sinceMs != null ? new Date(sinceMs).toISOString() : undefined;

  // Fetch balances + indexed trade history in parallel; each degrades to empty
  // so a slow/throttled Helius call can never hang the whole modal.
  const [balRes, splRes, swapRes] = await Promise.allSettled([
    getSolBalanceLamports(address),
    listNonZeroSplBalances(address),
    listAllSwapsForWallet(address, sinceIso ? { sinceIso } : undefined),
  ]);
  const solLamports = balRes.status === 'fulfilled' ? balRes.value : null;
  const spl = splRes.status === 'fulfilled' ? splRes.value : [];
  const walletSwaps: MintSwapRow[] = swapRes.status === 'fulfilled' ? swapRes.value : [];

  const heldMints = new Set(spl.map((s) => s.mint));
  const tradedMints = new Set(walletSwaps.map((s) => s.mint));
  const allMints = [...new Set([SOL_MINT, ...heldMints, ...tradedMints])];

  const [meta, prices] = await Promise.all([
    getTokensByMints(allMints).catch(() => new Map()),
    fetchUsdPricesForMints(allMints).catch(
      () => new Map<string, { usdPrice: number | null; priceChange24h: number | null }>(),
    ),
  ]);

  const solPrice = prices.get(SOL_MINT)?.usdPrice ?? null;
  const solUi = solLamports != null ? lamportsToSol(solLamports) : null;
  const solUsd = solUi != null && solPrice != null && Number.isFinite(solPrice) ? solUi * solPrice : null;

  // Per-mint realized/unrealized PnL for THIS wallet, derived from indexed swaps.
  const derived = new Map<string, ReturnType<typeof deriveWalletStatsFromSwaps>[number]>();
  const byMint = new Map<string, MintSwapRow[]>();
  for (const s of walletSwaps) {
    const arr = byMint.get(s.mint) ?? [];
    arr.push(s);
    byMint.set(s.mint, arr);
  }
  for (const [mint, rows] of byMint) {
    const decimals = meta.get(mint)?.decimals ?? 6;
    const currentPriceUsd = prices.get(mint)?.usdPrice ?? null;
    const d = deriveWalletStatsFromSwaps(rows, { currentPriceUsd, decimals });
    if (d[0]) derived.set(mint, d[0]);
  }

  // Current holdings (remaining value) by mint.
  const remainingByMint = new Map<string, { ui: number; usd: number | null }>();
  for (const row of spl) {
    const decimals = meta.get(row.mint)?.decimals ?? 6;
    const ui = Number(BigInt(row.rawAmount)) / 10 ** decimals;
    const px = prices.get(row.mint)?.usdPrice ?? null;
    const usd = px != null && Number.isFinite(px) && Number.isFinite(ui) ? ui * px : null;
    remainingByMint.set(row.mint, { ui, usd });
  }

  let totalTokenUsd = 0;
  let stableUsd = 0;
  const positionMints = [...new Set([...heldMints, ...tradedMints])].filter(
    (m) => m !== SOL_MINT && m !== WSOL_MINT,
  );

  let positions: WalletPositionRow[] = [];
  const pnlPctForBuckets: number[] = [];

  for (const mint of positionMints) {
    const t = meta.get(mint);
    const decimals = t?.decimals ?? 6;
    const symbol = t?.symbol?.trim() || mint.slice(0, 4);
    const d = derived.get(mint);
    const rem = remainingByMint.get(mint);
    const remainingUsd = rem?.usd ?? null;
    const remainingTokenUi = rem?.ui ?? (d ? d.remaining_token_ui : null);

    if (isPortfolioFundingAsset(mint, t?.symbol ?? null)) {
      if (remainingUsd != null && Number.isFinite(remainingUsd)) stableUsd += remainingUsd;
      continue;
    }
    if (remainingUsd != null && Number.isFinite(remainingUsd)) totalTokenUsd += remainingUsd;

    const boughtUsd = d?.buy_usd ?? null;
    const soldUsd = d?.sell_usd ?? null;
    const realized = d?.realized_pnl_usd ?? null;
    const unrealized = d?.unrealized_pnl_usd ?? null;
    const pnlUsd = d ? (realized ?? 0) + (unrealized ?? 0) : null;
    const pnlPct =
      boughtUsd != null && boughtUsd > 0 && pnlUsd != null ? (pnlUsd / boughtUsd) * 100 : null;
    if (d && boughtUsd != null && boughtUsd > 0 && realized != null) {
      pnlPctForBuckets.push((realized / boughtUsd) * 100);
    }

    positions.push({
      mint,
      symbol,
      name: t?.name ?? null,
      imageUrl: t?.image_url ?? null,
      decimals,
      chain: 'sol',
      boughtUsd,
      boughtTokenUi: d ? d.bought_token_raw / 10 ** decimals : null,
      boughtTxnCount: null,
      soldUsd,
      soldTokenUi: d ? d.sold_token_raw / 10 ** decimals : null,
      soldTxnCount: null,
      remainingUsd,
      remainingTokenUi,
      pnlUsd,
      pnlPct,
      lastActivityLabel: relTimeLabel(d?.last_trade_at ?? null),
    });
  }

  // Dust-filter + rank by relevance (|PnL| then remaining) + cap.
  const relevance = (p: WalletPositionRow) =>
    Math.max(Math.abs(p.pnlUsd ?? 0), p.remainingUsd ?? 0, p.boughtUsd ?? 0);
  positions = positions
    .filter((p) => relevance(p) >= DUST_USD)
    .sort((a, b) => relevance(b) - relevance(a))
    .slice(0, MAX_POSITIONS);

  const totalValueUsd = (solUsd ?? 0) + totalTokenUsd > 0 ? (solUsd ?? 0) + totalTokenUsd : solUsd;

  // Performance — timeframe-scoped from indexed swaps when present, else fall
  // back to the 30d wallet_stats aggregate (honest '—' when neither exists).
  const haveSwaps = derived.size > 0;
  const realizedTotal = haveSwaps
    ? [...derived.values()].reduce((s, d) => s + (d.realized_pnl_usd || 0), 0)
    : null;
  const unrealizedTotal = haveSwaps
    ? [...derived.values()].reduce((s, d) => s + (d.unrealized_pnl_usd || 0), 0)
    : null;
  const wins = haveSwaps ? [...derived.values()].filter((d) => d.realized_pnl_usd > 0).length : null;
  const losses = haveSwaps ? [...derived.values()].filter((d) => d.realized_pnl_usd < 0).length : null;
  const winRatePct =
    wins != null && losses != null && wins + losses > 0 ? (wins / (wins + losses)) * 100 : null;

  const txns = haveSwaps ? walletSwaps.length : stats?.trades_30d ?? null;
  const realizedPnlUsd = realizedTotal ?? null;
  const totalPnlUsd = haveSwaps
    ? (realizedTotal ?? 0) + (unrealizedTotal ?? 0)
    : pickTimeframePnlUsd(stats, timeframe);
  const buckets = haveSwaps
    ? buildPnlBuckets(pnlPctForBuckets)
    : [];

  let funding: WalletFundingInfo | null = null;
  try {
    const incoming = await findRecentIncomingSolFunding(address);
    if (incoming) {
      const sol = lamportsToSol(incoming.lamportsReceived);
      const periodLabel =
        timeframe === '1d' ? '1d' : timeframe === '7d' ? '7d' : timeframe === '30d' ? '30d' : 'Max';
      funding = {
        fromAddress: incoming.fromAddress,
        fundingTxSignature: incoming.signature,
        amountSol: Number.isFinite(sol) ? sol : null,
        periodLabel,
      };
    }
  } catch {
    funding = null;
  }

  return {
    address,
    chain: 'sol',
    statsComputedAt: stats?.computed_at ?? null,
    solLamports: solLamports != null ? solLamports.toString() : null,
    solUsd,
    totalValueUsd: totalValueUsd != null && totalValueUsd > 0 ? totalValueUsd : solUsd,
    unrealizedPnlUsd: unrealizedTotal,
    tradeableBalanceUsd: solUsd,
    stableCoinBalanceUsd: stableUsd > 0 ? stableUsd : null,
    walletAgeLabel: null,
    nativeBalanceLabel: null,
    funding,
    chart: realizedPnlCurve(byMint),
    positions,
    performance: {
      totalPnlUsd,
      realizedPnlUsd,
      txns,
      // 0-100 percent for the UI (which renders `${winRatePct}%`).
      winRatePct,
      coinsTraded: haveSwaps ? derived.size : null,
    },
    buckets,
  };
}
