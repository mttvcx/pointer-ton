import type { MintSwapRow } from '@/lib/db/mintSwaps';
import { getWalletEntry } from '@/lib/identity/registry';

const MS_7D = 7 * 86400000;
const MS_30D = 30 * 86400000;

function fifoRealized(
  legs: { side: 'buy' | 'sell'; qty: number; unitUsd: number; ts: number }[],
  cutoffMs: number,
): { pnl: number; wins: number; losses: number; trades: number; volume: number } {
  const filtered = legs.filter((l) => l.ts >= cutoffMs);
  const lots: { qty: number; unitUsd: number }[] = [];
  let pnl = 0;
  let wins = 0;
  let losses = 0;
  let volume = 0;

  for (const t of filtered) {
    volume += t.qty * t.unitUsd;
    if (t.side === 'buy') {
      lots.push({ qty: t.qty, unitUsd: t.unitUsd });
      continue;
    }
    let sellLeft = t.qty;
    let cost = 0;
    while (sellLeft > 1e-12 && lots.length > 0) {
      const lot = lots[0]!;
      const take = Math.min(sellLeft, lot.qty);
      cost += take * lot.unitUsd;
      lot.qty -= take;
      sellLeft -= take;
      if (lot.qty <= 1e-12) lots.shift();
    }
    const proceeds = t.qty * t.unitUsd;
    const delta = proceeds - cost;
    pnl += delta;
    if (delta > 0) wins += 1;
    else if (delta < 0) losses += 1;
  }

  return { pnl, wins, losses, trades: filtered.length, volume };
}

function buildLegs(rows: MintSwapRow[]): { side: 'buy' | 'sell'; qty: number; unitUsd: number; ts: number }[] {
  const legs: { side: 'buy' | 'sell'; qty: number; unitUsd: number; ts: number }[] = [];
  for (const r of rows) {
    if (r.event_kind && r.event_kind !== 'swap') continue;
    const px =
      r.price_usd != null && r.price_usd > 0
        ? r.price_usd
        : r.usd_amount != null && r.token_amount_ui > 0
          ? r.usd_amount / r.token_amount_ui
          : 0;
    if (px <= 0) continue;
    legs.push({
      side: r.side,
      qty: r.token_amount_ui,
      unitUsd: px,
      ts: new Date(r.block_time).getTime(),
    });
  }
  return legs;
}

/** Pure aggregation — testable without Supabase. */
export function computeWalletStatsRowsFromSwaps(
  swaps: MintSwapRow[],
): {
  wallet: string;
  pnl_usd_30d: number;
  pnl_usd_7d: number;
  win_rate_30d: number | null;
  trades_30d: number;
  total_volume_30d_usd: number;
  is_kol: boolean;
  kol_handle: string | null;
}[] {
  const now = Date.now();
  const byWallet = new Map<string, MintSwapRow[]>();
  for (const s of swaps) {
    const bucket = byWallet.get(s.wallet) ?? [];
    bucket.push(s);
    byWallet.set(s.wallet, bucket);
  }

  const out: ReturnType<typeof computeWalletStatsRowsFromSwaps> = [];
  for (const [wallet, rows] of byWallet) {
    const legs = buildLegs(rows);
    if (legs.length === 0) continue;
    const m30 = fifoRealized(legs, now - MS_30D);
    const m7 = fifoRealized(legs, now - MS_7D);
    const winRate =
      m30.wins + m30.losses > 0 ? m30.wins / (m30.wins + m30.losses) : null;
    const kolEntry = getWalletEntry('sol', wallet);
    out.push({
      wallet,
      pnl_usd_30d: m30.pnl,
      pnl_usd_7d: m7.pnl,
      win_rate_30d: winRate,
      trades_30d: m30.trades,
      total_volume_30d_usd: m30.volume,
      is_kol: kolEntry?.profile.primaryCategory === 'kol',
      kol_handle: kolEntry?.profile.twitterHandle ?? null,
    });
  }
  return out;
}
