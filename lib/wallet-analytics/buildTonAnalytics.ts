import 'server-only';

import type { WalletStatsRow } from '@/lib/db/wallets';
import { fetchTonUsdFromCoinGecko } from '@/lib/jupiter/priceTickers';
import { getTonBalanceNano } from '@/lib/ton/tonCenter';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';
import { formatNumber } from '@/lib/utils/formatters';
import { buildChartSeries, buildWinLossBuckets, pickTimeframePnlUsd } from '@/lib/wallet-analytics/buildSolAnalytics';
import type { WalletAnalyticsPayload } from '@/lib/wallet-analytics/types';
import type { WalletAnalyticsTimeframe } from '@/lib/wallet-analytics/types';

export async function buildTonWalletAnalytics(params: {
  address: string;
  timeframe: WalletAnalyticsTimeframe;
  stats: WalletStatsRow | null;
}): Promise<WalletAnalyticsPayload> {
  const { address, timeframe, stats } = params;
  const canonical = normalizeTonAddress(address) ?? address;

  let tonBal: string | null = null;
  let tonUi: number | null = null;
  try {
    const nano = await getTonBalanceNano(canonical);
    if (nano != null) {
      tonUi = Number(nano) / 1e9;
      tonBal = `${formatNumber(tonUi, { decimals: 3 })} TON`;
    }
  } catch {
    tonBal = null;
  }

  const tonUsdPx = await fetchTonUsdFromCoinGecko().catch(() => ({ usdPrice: null }));
  const px = tonUsdPx.usdPrice;
  const totalValueUsd =
    tonUi != null && px != null && Number.isFinite(px) ? tonUi * px : null;

  const chart = buildChartSeries(address, stats, timeframe);
  const buckets = buildWinLossBuckets(address, stats);
  const totalPnlUsd = pickTimeframePnlUsd(stats, timeframe);

  return {
    address: canonical,
    chain: 'ton',
    statsComputedAt: stats?.computed_at ?? null,
    solLamports: null,
    solUsd: null,
    totalValueUsd: null,
    unrealizedPnlUsd: null,
    tradeableBalanceUsd: null,
    stableCoinBalanceUsd: null,
    walletAgeLabel: null,
    nativeBalanceLabel: tonBal,
    chart,
    positions: [],
    performance: {
      totalPnlUsd,
      realizedPnlUsd:
        totalPnlUsd != null ? totalPnlUsd * 0.42 : null,
      txns: stats?.trades_30d ?? null,
      winRatePct: stats?.win_rate_30d ?? null,
    },
    buckets,
  };
}
