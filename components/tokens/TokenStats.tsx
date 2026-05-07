import { StatStrip, type StatItem } from '@/components/shared/StatStrip';
import {
  formatCompactUsd,
  formatNumber,
  formatPercent,
  formatPriceUsd,
} from '@/lib/utils/formatters';
import type { TokenMarketSnapshotRow } from '@/lib/db/tokens';

export function TokenStats({
  snapshot,
  dense = true,
}: {
  snapshot: TokenMarketSnapshotRow | null;
  dense?: boolean;
}) {
  const top10 = snapshot?.top10_holder_pct;
  const items: StatItem[] = [
    { label: 'Price', value: formatPriceUsd(snapshot?.price_usd) },
    { label: 'Market cap', value: formatCompactUsd(snapshot?.market_cap_usd) },
    { label: 'Liquidity', value: formatCompactUsd(snapshot?.liquidity_usd) },
    { label: 'Vol 24h', value: formatCompactUsd(snapshot?.volume_24h_usd) },
    {
      label: 'Holders',
      value: snapshot?.holder_count != null ? formatNumber(snapshot.holder_count, { decimals: 0 }) : '\u2014',
    },
    {
      label: 'Top-10 %',
      value: top10 != null ? formatPercent(top10, { decimals: 1 }) : '\u2014',
      tone: top10 != null && top10 > 40 ? 'warn' : 'default',
    },
  ];
  return <StatStrip items={items} dense={dense} className="max-w-full" />;
}
