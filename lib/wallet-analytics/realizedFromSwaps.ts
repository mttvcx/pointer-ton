import type { MintSwapRow } from '@/lib/db/mintSwaps';
import type { WalletAnalyticsChartPoint } from '@/lib/wallet-analytics/types';

const EPS = 1e-9;
const MAX_POINTS = 48;

/**
 * Realized PnL + cumulative curve for a wallet straight from indexed swaps —
 * per-mint FIFO lot matching, deltas merged across mints in time order and
 * accumulated. Uses the USD already stored on each swap (no live price fetch), so
 * it's fast: the extension's ring / hover chart read path. Every point is a real
 * realized sell event.
 */
export function realizedFromSwaps(swaps: MintSwapRow[]): {
  realizedPnlUsd: number;
  chart: WalletAnalyticsChartPoint[];
} {
  const byMint = new Map<string, MintSwapRow[]>();
  for (const s of swaps) {
    const arr = byMint.get(s.mint) ?? [];
    arr.push(s);
    byMint.set(s.mint, arr);
  }

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
      if (px <= 0 || qty <= EPS) continue;
      if (r.side === 'buy') {
        lots.push({ qty, unitUsd: px });
        continue;
      }
      let sellLeft = qty;
      let cost = 0;
      while (sellLeft > EPS && lots.length > 0) {
        const lot = lots[0]!;
        const take = Math.min(sellLeft, lot.qty);
        cost += take * lot.unitUsd;
        lot.qty -= take;
        sellLeft -= take;
        if (lot.qty <= EPS) lots.shift();
      }
      const t = Date.parse(r.block_time);
      if (Number.isFinite(t)) events.push({ t, d: qty * px - cost });
    }
  }

  if (events.length === 0) return { realizedPnlUsd: 0, chart: [] };
  events.sort((a, b) => a.t - b.t);
  let cum = 0;
  let pts: WalletAnalyticsChartPoint[] = events.map((e) => {
    cum += e.d;
    return { t: e.t, v: Math.round(cum) };
  });
  const realizedPnlUsd = Math.round(cum);
  if (pts.length > MAX_POINTS) {
    const step = (pts.length - 1) / (MAX_POINTS - 1);
    const sampled: WalletAnalyticsChartPoint[] = [];
    for (let i = 0; i < MAX_POINTS; i++) sampled.push(pts[Math.round(i * step)]!);
    pts = sampled;
  }
  return { realizedPnlUsd, chart: pts };
}
