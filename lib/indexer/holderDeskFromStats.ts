import { formatCompactNumber, formatCompactUsd } from '@/lib/format';
import type { MintWalletStatsRow } from '@/lib/db/mintWalletStats';
import type { HolderDeskSynth } from '@/lib/tokens/holderDeskSynth';

/** Build real holder desk columns from indexed wallet stats. */
export function holderDeskFromWalletStats(
  stats: MintWalletStatsRow,
  pctSupply: number | null,
  decimals = 6,
): HolderDeskSynth {
  const scale = 10 ** decimals;
  const boughtUi = stats.bought_token_raw / scale;
  const soldUi = stats.sold_token_raw / scale;
  const remainingUsd =
    stats.remaining_token_ui > 0 && stats.avg_buy_usd != null
      ? stats.remaining_token_ui * stats.avg_buy_usd
      : stats.remaining_token_ui > 0 && stats.unrealized_pnl_usd != null
        ? Math.max(0, stats.unrealized_pnl_usd + stats.buy_usd - stats.sell_usd)
        : 0;

  const totalPnl = stats.realized_pnl_usd + (stats.unrealized_pnl_usd ?? 0);

  return {
    solBalance: 0,
    lastActive: stats.last_trade_at
      ? new Date(stats.last_trade_at).toLocaleDateString()
      : '\u2014',
    boughtUsd: stats.buy_usd > 0 ? formatCompactUsd(stats.buy_usd) : '\u2014',
    boughtTokensCompact: boughtUi > 0 ? formatCompactNumber(boughtUi) : '\u2014',
    buyTxCount: boughtUi > 0 ? 1 : 0,
    avgBuyUsd: stats.avg_buy_usd != null ? formatCompactUsd(stats.avg_buy_usd) : null,
    soldUsd: stats.sell_usd > 0 ? formatCompactUsd(stats.sell_usd) : '\u2014',
    soldTokensCompact: soldUi > 0 ? formatCompactNumber(soldUi) : '\u2014',
    sellTxCount: soldUi > 0 ? 1 : 0,
    avgSellUsd: stats.avg_sell_usd != null ? formatCompactUsd(stats.avg_sell_usd) : null,
    uPnlUsd: `${totalPnl >= 0 ? '+' : ''}${formatCompactUsd(totalPnl)}`,
    uPnlUsdRaw: totalPnl,
    remainingUsd: remainingUsd > 0 ? formatCompactUsd(remainingUsd) : '\u2014',
    pctLine:
      pctSupply != null && Number.isFinite(pctSupply)
        ? Math.min(100, Math.max(0, pctSupply))
        : stats.remaining_token_ui > 0
          ? 8
          : 0,
    funding: null,
    heldAge:
      stats.first_trade_at && stats.last_trade_at
        ? formatHeldSpan(stats.first_trade_at, stats.last_trade_at)
        : '\u2014',
  };
}

function formatHeldSpan(first: string, last: string): string {
  const ms = new Date(last).getTime() - new Date(first).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '\u2014';
  const h = ms / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(ms / 60_000))}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}
