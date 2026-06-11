import 'server-only';

import { getTokensByMints } from '@/lib/db/tokens';
import type { WalletStatsRow } from '@/lib/db/wallets';
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

/**
 * Cumulative PnL curve — live mode only renders a real series. Until per-trade
 * history is indexed for arbitrary wallets, return empty (UI shows an honest
 * "no chart data" state) instead of a fabricated curve.
 */
export function buildChartSeries(
  _walletAddress: string,
  _stats: WalletStatsRow | null,
  _tf: WalletAnalyticsTimeframe,
): WalletAnalyticsChartPoint[] {
  return [];
}

/**
 * Win/loss distribution from real stats only. Without `wallet_stats` rows the
 * list is empty; with stats we show real win/loss totals (no fabricated %-band
 * split — that needs per-trade history).
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

  const wins = Math.max(0, Math.round((trades * Math.min(100, Math.max(0, winRate))) / 100));
  const losses = Math.max(0, Math.round(trades) - wins);

  return [
    { id: 'wins', label: 'Wins (30d)', count: wins, tone: 'bull' },
    { id: 'losses', label: 'Losses (30d)', count: losses, tone: 'bear' },
  ];
}

export async function buildSolWalletAnalytics(params: {
  address: string;
  timeframe: WalletAnalyticsTimeframe;
  stats: WalletStatsRow | null;
}): Promise<WalletAnalyticsPayload> {
  const { address, timeframe, stats } = params;

  let solLamports: bigint | null = null;
  let spl: Awaited<ReturnType<typeof listNonZeroSplBalances>> = [];
  try {
    solLamports = await getSolBalanceLamports(address);
    spl = await listNonZeroSplBalances(address);
  } catch {
    solLamports = null;
    spl = [];
  }

  const mints = [SOL_MINT, ...spl.map((s) => s.mint)];
  const meta = await getTokensByMints(mints);
  const prices = await fetchUsdPricesForMints(mints).catch(() => new Map());

  const solPrice = prices.get(SOL_MINT)?.usdPrice ?? null;
  const solUi =
    solLamports != null ? lamportsToSol(solLamports) : null;
  const solUsd =
    solUi != null && solPrice != null && Number.isFinite(solPrice) ? solUi * solPrice : null;

  let totalTokenUsd = 0;
  let stableUsd = 0;
  const positions: WalletPositionRow[] = [];

  for (const row of spl) {
    const t = meta.get(row.mint);
    const decimals = t?.decimals ?? 6;
    const symbol = t?.symbol?.trim() || row.mint.slice(0, 4);
    const name = t?.name ?? null;
    const imageUrl = t?.image_url ?? null;
    const raw = BigInt(row.rawAmount);
    const ui = Number(raw) / 10 ** decimals;
    const px = prices.get(row.mint)?.usdPrice ?? null;
    const usd = px != null && Number.isFinite(px) && Number.isFinite(ui) ? ui * px : null;
    if (isPortfolioFundingAsset(row.mint, t?.symbol ?? null)) {
      if (usd != null && Number.isFinite(usd)) stableUsd += usd;
      continue;
    }
    if (usd != null && Number.isFinite(usd)) totalTokenUsd += usd;

    positions.push({
      mint: row.mint,
      symbol,
      name,
      imageUrl,
      decimals,
      chain: 'sol',
      boughtUsd: null,
      boughtTokenUi: null,
      soldUsd: null,
      soldTokenUi: null,
      remainingUsd: usd,
      remainingTokenUi: Number.isFinite(ui) ? ui : null,
      pnlUsd: null,
      pnlPct: null,
    });
  }

  positions.sort((a, b) => (b.remainingUsd ?? 0) - (a.remainingUsd ?? 0));

  const totalValueUsd =
    (solUsd ?? 0) + totalTokenUsd > 0 ? (solUsd ?? 0) + totalTokenUsd : solUsd;

  const chart = buildChartSeries(address, stats, timeframe);
  const buckets = buildWinLossBuckets(address, stats);

  const totalPnlUsd = pickTimeframePnlUsd(stats, timeframe);
  /** Realized split needs per-trade history — never approximate in live mode. */
  const realizedPnlUsd: number | null = null;

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
    unrealizedPnlUsd: null,
    tradeableBalanceUsd: solUsd,
    stableCoinBalanceUsd: stableUsd > 0 ? stableUsd : null,
    walletAgeLabel: null,
    nativeBalanceLabel: null,
    funding,
    chart,
    positions,
    performance: {
      totalPnlUsd,
      realizedPnlUsd,
      txns: stats?.trades_30d ?? null,
      winRatePct: stats?.win_rate_30d ?? null,
    },
    buckets,
  };
}
