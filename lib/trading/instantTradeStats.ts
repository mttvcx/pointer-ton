/**
 * Lifetime buy/sell TON totals from the instant panel (per mint + wallet), for PnL strip display.
 */

const PREFIX = 'pointer-instant-stats-v1';

function storageKey(mint: string, wallet: string): string {
  return `${PREFIX}:${mint}:${wallet}`;
}

export type InstantTradeLifetimeStats = { buyTon: number; sellTon: number };

export const INSTANT_TRADE_STATS_EVT = 'pointer:instant-trade-stats';

function notifyInstantTradeStats(mint: string, wallet: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(INSTANT_TRADE_STATS_EVT, { detail: { mint, wallet } }),
  );
}

export function readInstantTradeLifetimeStats(mint: string, wallet: string): InstantTradeLifetimeStats {
  if (typeof window === 'undefined') return { buyTon: 0, sellTon: 0 };
  try {
    const raw = localStorage.getItem(storageKey(mint, wallet));
    if (!raw) return { buyTon: 0, sellTon: 0 };
    const j = JSON.parse(raw) as Partial<InstantTradeLifetimeStats>;
    const buyTon =
      typeof j.buyTon === 'number' && Number.isFinite(j.buyTon) ? Math.max(0, j.buyTon) : 0;
    const sellTon =
      typeof j.sellTon === 'number' && Number.isFinite(j.sellTon) ? Math.max(0, j.sellTon) : 0;
    return { buyTon, sellTon };
  } catch {
    return { buyTon: 0, sellTon: 0 };
  }
}

export function addInstantTradeBuyTon(mint: string, wallet: string, ton: number): void {
  if (!Number.isFinite(ton) || ton <= 0) return;
  if (typeof window === 'undefined') return;
  try {
    const cur = readInstantTradeLifetimeStats(mint, wallet);
    localStorage.setItem(
      storageKey(mint, wallet),
      JSON.stringify({ ...cur, buyTon: cur.buyTon + ton }),
    );
    notifyInstantTradeStats(mint, wallet);
  } catch {
    /* quota */
  }
}

/** Add estimated TON received from a sell. */
export function addInstantTradeSellTon(mint: string, wallet: string, ton: number): void {
  if (!Number.isFinite(ton) || ton <= 0) return;
  if (typeof window === 'undefined') return;
  try {
    const cur = readInstantTradeLifetimeStats(mint, wallet);
    localStorage.setItem(
      storageKey(mint, wallet),
      JSON.stringify({ ...cur, sellTon: cur.sellTon + ton }),
    );
    notifyInstantTradeStats(mint, wallet);
  } catch {
    /* quota */
  }
}
