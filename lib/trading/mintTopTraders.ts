/**
 * Rank wallets by realized PnL on a single mint (not global wallet_stats).
 * Uses FIFO cost basis on amount_token times price_usd_at_fill from confirmed trades.
 */

export type MintTopTraderRow = {
  wallet_address: string;
  /** Realized USD on this mint in the window (FIFO). */
  realized_pnl_usd: number;
  /** Wins / sells for this mint in the window; null if no sells. */
  win_rate: number | null;
  trades: number;
  /** Notional USD bought (sum of fills) in window. */
  buy_usd: number;
  /** Notional USD sold in window. */
  sell_usd: number;
  buy_count: number;
  sell_count: number;
  /** Total token qty bought / sold in window (raw float units). */
  buy_token_qty: number;
  sell_token_qty: number;
  /** Volume-weighted average USD price per token on buys; null if no buys. */
  avg_buy_usd_per_token: number | null;
  avg_sell_usd_per_token: number | null;
  first_trade_at: string | null;
  last_trade_at: string | null;
  /** Span from first to last fill on this mint in window; null if unknown. */
  held_seconds: number | null;
};

type TradeLeg = {
  side: 'buy' | 'sell';
  amount_token: number;
  price_usd: number;
  ts: number;
};

const EPS = 1e-9;

function fifoRealizedForWallet(legs: TradeLeg[]): {
  realized: number;
  sells: number;
  wins: number;
} {
  const lots: { qty: number; unitUsd: number }[] = [];
  let realized = 0;
  let sells = 0;
  let wins = 0;

  for (const t of legs) {
    if (t.side === 'buy') {
      lots.push({ qty: t.amount_token, unitUsd: t.price_usd });
      continue;
    }
    let sellLeft = t.amount_token;
    let cost = 0;
    while (sellLeft > EPS && lots.length > 0) {
      const lot = lots[0]!;
      const take = Math.min(sellLeft, lot.qty);
      cost += take * lot.unitUsd;
      lot.qty -= take;
      sellLeft -= take;
      if (lot.qty <= EPS) lots.shift();
    }
    const proceeds = t.amount_token * t.price_usd;
    const pnl = proceeds - cost;
    realized += pnl;
    sells += 1;
    if (pnl > EPS) wins += 1;
  }

  return { realized, sells, wins };
}

export function buildMintTopTraders(params: {
  trades: {
    user_id: string;
    side: string;
    amount_token: number | null;
    price_usd_at_fill: number | null;
    confirmed_at: string | null;
    submitted_at: string;
  }[];
  userIdToWallet: Map<string, string>;
  cutoffMs: number;
  limit: number;
}): MintTopTraderRow[] {
  const byWallet = new Map<string, TradeLeg[]>();

  for (const row of params.trades) {
    const wallet = params.userIdToWallet.get(row.user_id);
    if (!wallet) continue;

    const ts = new Date(row.confirmed_at ?? row.submitted_at).getTime();
    if (ts < params.cutoffMs) continue;

    const qty = row.amount_token;
    const px = row.price_usd_at_fill;
    if (qty == null || !Number.isFinite(qty) || qty <= 0) continue;
    if (px == null || !Number.isFinite(px) || px < 0) continue;
    if (row.side !== 'buy' && row.side !== 'sell') continue;

    const leg: TradeLeg = { side: row.side, amount_token: qty, price_usd: px, ts };
    const arr = byWallet.get(wallet) ?? [];
    arr.push(leg);
    byWallet.set(wallet, arr);
  }

  const out: MintTopTraderRow[] = [];

  for (const [wallet_address, legs] of byWallet) {
    legs.sort((a, b) => a.ts - b.ts);

    let buy_usd = 0;
    let sell_usd = 0;
    let buy_count = 0;
    let sell_count = 0;
    let buy_qty = 0;
    let sell_qty = 0;
    for (const t of legs) {
      const v = t.amount_token * t.price_usd;
      if (t.side === 'buy') {
        buy_usd += v;
        buy_qty += t.amount_token;
        buy_count += 1;
      } else {
        sell_usd += v;
        sell_qty += t.amount_token;
        sell_count += 1;
      }
    }

    const { realized, sells, wins } = fifoRealizedForWallet(legs);
    const win_rate = sells > 0 ? wins / sells : null;
    const firstTs = legs[0]?.ts;
    const lastTs = legs[legs.length - 1]?.ts;
    const held_seconds =
      firstTs != null && lastTs != null && lastTs > firstTs
        ? (lastTs - firstTs) / 1000
        : legs.length === 1
          ? 0
          : null;

    out.push({
      wallet_address,
      realized_pnl_usd: realized,
      win_rate,
      trades: legs.length,
      buy_usd,
      sell_usd,
      buy_count,
      sell_count,
      buy_token_qty: buy_qty,
      sell_token_qty: sell_qty,
      avg_buy_usd_per_token: buy_qty > EPS ? buy_usd / buy_qty : null,
      avg_sell_usd_per_token: sell_qty > EPS ? sell_usd / sell_qty : null,
      first_trade_at: firstTs != null ? new Date(firstTs).toISOString() : null,
      last_trade_at: lastTs != null ? new Date(lastTs).toISOString() : null,
      held_seconds,
    });
  }

  out.sort((a, b) => b.realized_pnl_usd - a.realized_pnl_usd);
  return out.slice(0, params.limit);
}

/** Hover / modal: one wallet on one mint from confirmed trade rows (all time in payload). */
export type TraderMintHoverStats = {
  buy_count: number;
  sell_count: number;
  buy_usd: number;
  sell_usd: number;
  realized_pnl_usd: number;
  win_rate: number | null;
  first_trade_at: string | null;
};

export function traderMintStatsFromTradeRows(
  rows: {
    side: string;
    amount_token: number | null;
    price_usd_at_fill: number | null;
    submitted_at: string;
    confirmed_at: string | null;
  }[],
): TraderMintHoverStats | null {
  const legs: TradeLeg[] = [];
  for (const row of rows) {
    const qty = row.amount_token;
    const px = row.price_usd_at_fill;
    if (qty == null || !Number.isFinite(qty) || qty <= 0) continue;
    if (px == null || !Number.isFinite(px) || px < 0) continue;
    if (row.side !== 'buy' && row.side !== 'sell') continue;
    const ts = new Date(row.confirmed_at ?? row.submitted_at).getTime();
    legs.push({ side: row.side, amount_token: qty, price_usd: px, ts });
  }
  if (legs.length === 0) return null;
  legs.sort((a, b) => a.ts - b.ts);
  let buy_usd = 0;
  let sell_usd = 0;
  let buy_count = 0;
  let sell_count = 0;
  for (const t of legs) {
    const v = t.amount_token * t.price_usd;
    if (t.side === 'buy') {
      buy_usd += v;
      buy_count += 1;
    } else {
      sell_usd += v;
      sell_count += 1;
    }
  }
  const { realized, sells, wins } = fifoRealizedForWallet(legs);
  return {
    buy_count,
    sell_count,
    buy_usd,
    sell_usd,
    realized_pnl_usd: realized,
    win_rate: sells > 0 ? wins / sells : null,
    first_trade_at: new Date(legs[0]!.ts).toISOString(),
  };
}
