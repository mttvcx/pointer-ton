/**
 * Real wallet intelligence for a handle — the single fetch path the avatar ring,
 * portfolio popup, and hover chart all share. Resolves the handle's linked Solana
 * wallet(s) via /api/ext/profile, pulls each wallet's analytics from
 * /api/ext/wallet, and COMBINES them (net worth + realized PnL summed, cumulative
 * realized-PnL curves merged). Results are cached (and in-flight deduped) per
 * handle+timeframe, so N surfaces showing the same account cost one round-trip.
 */
import { pointer } from '@/pointer/client';
import type { ProfileIntel, WalletIntel } from '@/pointer/types';

export type WalletData = {
  name: string | null;
  netWorthUsd: number | null;
  realizedPnlUsd: number | null;
  chart: { v: number }[];
};

// null = account has no linked wallet (→ no ring, no popup PnL).
const cache = new Map<string, Promise<WalletData | null>>();

export function getWalletData(handle: string, timeframe = '30d'): Promise<WalletData | null> {
  const key = `${handle.toLowerCase()}:${timeframe}`;
  let p = cache.get(key);
  if (!p) {
    p = fetchCombined(handle, timeframe);
    cache.set(key, p);
    // Transient failure (e.g. not connected yet) rejects — drop it so the next
    // call refetches. Otherwise a pre-connect miss would stick until page reload.
    void p.catch(() => cache.delete(key));
  }
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

  const results = await Promise.all(addrs.map((a) => pointer.wallet(a, timeframe)));
  const intels = results.map((r) => (r.ok ? (r.data as WalletIntel) : null)).filter((x): x is WalletIntel => x != null);
  if (!intels.length) throw new Error('wallet_unavailable'); // all fetches errored → retry, don't cache

  return {
    name: prof.name ?? null,
    netWorthUsd: sumNullable(intels.map((i) => i.netWorthUsd)),
    realizedPnlUsd: sumNullable(intels.map((i) => i.realizedPnlUsd)),
    chart: combineCurves(intels.map((i) => i.chart ?? [])),
  };
}

function sumNullable(vals: (number | null)[]): number | null {
  const nums = vals.filter((v): v is number => v != null && Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
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
