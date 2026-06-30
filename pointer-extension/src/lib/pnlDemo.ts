/**
 * Deterministic DEMO wallet data, one source of truth so every surface agrees
 * (e.g. blknoiz06 ≈ +$40k on the avatar ring, the hover chart, and the portfolio
 * popup). This exists only to perfect the UI/UX before wiring real data.
 *
 * WIRE-READY: each call site reads `demoPnl` / `demoNetWorth` / `demoCurve` /
 * `demoWallet`. To go live, replace those reads with the real /api/ext/wallet
 * values (realizedPnlUsd, totalValueUsd, chart) — the shapes already match.
 */

function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h >>> 0;
}
function prng(s: string): () => number {
  let h = hash(s) || 1;
  return () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h / 4294967296;
  };
}

/** Headline realized PnL (≈ -8k … +40k, biased positive). */
export function demoPnl(handle: string): number {
  return Math.round((hash(handle) / 4294967296) * 48000 - 8000);
}

/** Current net worth (≈ 1k … 900k). */
export function demoNetWorth(handle: string): number {
  return Math.round((hash(`${handle}:nw`) / 4294967296) * 900000 + 1000);
}

const TF_FRAC: Record<string, number> = { '1d': 0.12, '7d': 0.35, '30d': 0.7, max: 1 };

/** Realized-PnL curve that ends at demoPnl × timeframe-fraction, with realistic wiggle. */
export function demoCurve(handle: string, tf: string): { v: number }[] {
  const target = demoPnl(handle) * (TF_FRAC[tf] ?? 1);
  const n = tf === '1d' ? 24 : tf === '7d' ? 30 : tf === '30d' ? 40 : 56;
  const rand = prng(`${handle}:${tf}`);
  const drift = (target >= 0 ? 1 : -1) * 0.3;
  const raw: number[] = [];
  let v = 0;
  for (let i = 0; i < n; i++) {
    v += rand() - 0.5 + drift;
    raw.push(v);
  }
  let last = raw[n - 1] ?? 1;
  if (Math.abs(last) < 0.5) last = last < 0 ? -0.5 : 0.5;
  return raw.map((x) => ({ v: Math.round((x / last) * target) }));
}

/** Bundled demo wallet — what /api/ext/wallet will return for real. */
export function demoWallet(handle: string): { netWorthUsd: number; realizedPnlUsd: number; chart: { v: number }[] } {
  return { netWorthUsd: demoNetWorth(handle), realizedPnlUsd: demoPnl(handle), chart: demoCurve(handle, 'max') };
}
