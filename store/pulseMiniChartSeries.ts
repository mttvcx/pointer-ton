'use client';

/**
 * Rolling per-mint price buffer that feeds the Pulse "Mini Chart" row background.
 *
 * This is a plain module singleton (NOT a zustand store) on purpose: rows push
 * their real observed `price_usd` every time the Pulse feed ticks, which is
 * high-churn, and we never want those pushes to trigger React re-renders. Rows
 * already re-render when their snapshot price changes, so the mini chart simply
 * reads the current buffer during that render — no subscription needed.
 *
 * Everything here is REAL data: the actual prices we've observed for a mint
 * while it's been on screen. A freshly-appeared row starts with a short line and
 * fills in as you watch it (same as any live chart) — nothing is synthesized.
 */

const MAX_POINTS = 48;
const MAX_MINTS = 600;

/** mint → recent prices (oldest → newest). */
const series = new Map<string, number[]>();

/** Record a freshly observed price for a mint. No-ops on junk / unchanged ticks. */
export function pushMiniChartPrice(mint: string, price: number | null | undefined): void {
  if (!mint || price == null || !Number.isFinite(price) || price <= 0) return;

  let buf = series.get(mint);
  if (!buf) {
    // Evict the oldest-inserted mint once we hit the cap (Map preserves insert order).
    if (series.size >= MAX_MINTS) {
      const oldest = series.keys().next().value;
      if (oldest !== undefined) series.delete(oldest);
    }
    buf = [];
    series.set(mint, buf);
  }

  // Skip exact-duplicate consecutive ticks so re-renders don't flatten the line.
  if (buf.length > 0 && buf[buf.length - 1] === price) return;

  buf.push(price);
  if (buf.length > MAX_POINTS) buf.splice(0, buf.length - MAX_POINTS);
}

/** Current price buffer for a mint (oldest → newest). Empty array if none yet. */
export function getMiniChartSeries(mint: string): number[] {
  return series.get(mint) ?? EMPTY;
}

const EMPTY: number[] = [];
