/**
 * Real wallet PnL for a handle — the single path the avatar ring, portfolio popup,
 * and hover chart share. Resolves the handle's linked Solana wallet(s) via
 * /api/ext/profile, then reads each wallet's realized PnL + curve from the FAST
 * /api/ext/wallet-pnl (indexed swaps, no live prices), COMBINED across wallets. A
 * miss triggers a bounded on-demand backfill server-side (`indexing: true`).
 *
 * Cached per handle+timeframe with a TTL that's short while indexing (so it
 * refreshes once data lands) and long once we have a final answer. Net worth is
 * NOT on this path (it needs the slow live-balance/price fetch) — it's null here.
 */
import { pointer } from '@/pointer/client';
import type { ProfileIntel, WalletPnl } from '@/pointer/types';

export type WalletData = {
  name: string | null;
  netWorthUsd: number | null;
  realizedPnlUsd: number | null;
  chart: { v: number }[];
  indexing: boolean;
};

type Entry = { at: number; ttl: number; p: Promise<WalletData | null> };
const cache = new Map<string, Entry>();

export function getWalletData(handle: string, timeframe = '30d'): Promise<WalletData | null> {
  const key = `${handle.toLowerCase()}:${timeframe}`;
  const e = cache.get(key);
  if (e && Date.now() - e.at < e.ttl) return e.p;
  const p = fetchCombined(handle, timeframe);
  const entry: Entry = { at: Date.now(), ttl: 60_000, p };
  cache.set(key, entry);
  void p
    .then((d) => {
      // Final (has PnL, or genuinely no wallet) caches long; still-indexing caches
      // short so the ring/popup pick up the data once the backfill lands.
      entry.ttl = d == null || (d.realizedPnlUsd != null && !d.indexing) ? 10 * 60_000 : 15_000;
    })
    .catch(() => cache.delete(key)); // transient failure → refetch next call
  return p;
}

async function fetchCombined(handle: string, timeframe: string): Promise<WalletData | null> {
  const pr = await pointer.profile(handle);
  if (!pr.ok) throw new Error(pr.error || 'profile_unavailable'); // transient — not cached
  const prof = pr.data as ProfileIntel;
  const wallets = prof.wallets ?? [];
  const sol = wallets.filter((w) => w.chain === 'sol');
  const addrs = (sol.length ? sol : wallets).map((w) => w.address);
  if (!addrs.length) return null; // genuine: no linked wallet → no ring

  const results = await Promise.all(addrs.map((a) => pointer.walletPnl(a, timeframe)));
  const oks = results.filter((r) => r.ok).map((r) => (r as { data: WalletPnl }).data);
  if (!oks.length) throw new Error('walletpnl_unavailable'); // all errored → retry

  const realized = oks.map((w) => w.realizedPnlUsd).filter((v): v is number => v != null);
  return {
    name: prof.name ?? null,
    netWorthUsd: null,
    realizedPnlUsd: realized.length ? realized.reduce((a, b) => a + b, 0) : null,
    chart: combineCurves(oks.map((w) => w.chart ?? [])),
    indexing: oks.some((w) => w.indexing),
  };
}

/** Merge cumulative realized-PnL curves ({t,v}) into one portfolio curve: at each
 *  timestamp, forward-fill each wallet's last cumulative value and sum. Returns {v}[]. */
function combineCurves(curves: { t: number; v: number }[][]): { v: number }[] {
  const valid = curves.filter((c) => c.length >= 2);
  if (valid.length === 0) return [];
  if (valid.length === 1) return valid[0]!.map((p) => ({ v: p.v }));

  const times = [...new Set(valid.flatMap((c) => c.map((p) => p.t)))].sort((a, b) => a - b);
  const idx = valid.map(() => 0);
  const lastV = valid.map(() => 0);
  const out: { v: number }[] = [];
  for (const t of times) {
    let total = 0;
    valid.forEach((c, wi) => {
      let i = idx[wi] ?? 0;
      let lv = lastV[wi] ?? 0;
      while (i < c.length && (c[i]?.t ?? Infinity) <= t) {
        lv = c[i]?.v ?? lv;
        i += 1;
      }
      idx[wi] = i;
      lastV[wi] = lv;
      total += lv;
    });
    out.push({ v: Math.round(total) });
  }
  if (out.length > 48) {
    const step = (out.length - 1) / 47;
    const s: { v: number }[] = [];
    for (let i = 0; i < 48; i++) s.push(out[Math.round(i * step)]!);
    return s;
  }
  return out;
}
