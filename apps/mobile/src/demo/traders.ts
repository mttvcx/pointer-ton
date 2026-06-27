/**
 * Rich demo trader profiles for the public profile screen — deterministic per
 * handle (seeded RNG, no Math.random) so the same trader always renders the same
 * numbers. Swap getDemoTrader() for a real `/api/users/:handle` response when the
 * backend ships a public-profile endpoint.
 */

export type TraderPosition = {
  sym: string;
  name: string;
  color: string;
  initial: string;
  verified: boolean;
  kind: 'token' | 'perp';
  closed: boolean;
  /** Closed → entry date label (e.g. "Feb 1 at 10:01 AM"). */
  dateLabel?: string;
  /** Open → raw token amount held (formatted in the UI). */
  heldAmount?: number;
  valueUsd: number;
  pnlUsd: number;
  pnlPct: number;
};

export type DemoTraderProfile = {
  handle: string;
  name: string;
  color: string;
  initial: string;
  xConnected: boolean;
  following: number;
  followers: number;
  mutuals: { color: string; initial: string }[];
  avgHold: string;
  trades: number;
  joined: string;
  portfolioUsd: number;
  pnl24hUsd: number;
  totalCashUsd: number;
  /** Normalized 0..1 portfolio series (oldest → newest). */
  chart: number[];
  open: TraderPosition[];
  closed: TraderPosition[];
};

const POOL: { sym: string; name: string; color: string; initial: string }[] = [
  { sym: 'MOLT', name: 'MOLT', color: '#7A1F1F', initial: 'M' },
  { sym: 'CLAWD', name: 'CLAWD', color: '#B5392B', initial: 'C' },
  { sym: '67', name: '67', color: '#C9A21E', initial: '6' },
  { sym: 'Chud', name: 'Chud', color: '#33373D', initial: 'C' },
  { sym: 'SHARE', name: 'SHARE', color: '#6E56CF', initial: 'S' },
  { sym: 'moltline', name: 'moltline', color: '#B5521E', initial: 'm' },
  { sym: 'unc', name: 'unc', color: '#9AA4B2', initial: 'u' },
  { sym: 'emo', name: 'emo', color: '#3A2E4A', initial: 'e' },
  { sym: 'VVM', name: 'VVM', color: '#3D3DCF', initial: 'V' },
  { sym: 'CC', name: 'CC', color: '#1A1A1A', initial: 'C' },
  { sym: 'COW', name: 'COW', color: '#9E7B4F', initial: 'C' },
  { sym: 'Buttcoin', name: 'Buttcoin', color: '#F7931A', initial: 'B' },
  { sym: 'KLEDAI', name: 'KLEDAI', color: '#2A2A2A', initial: 'K' },
  { sym: 'Alpie', name: 'Alpie', color: '#2E7D32', initial: 'A' },
  { sym: 'WIF', name: 'dogwifhat', color: '#C98A5E', initial: 'W' },
  { sym: 'ZERO', name: 'ZERO', color: '#0A0A0A', initial: '0' },
];

const MUTUAL_COLORS = ['#1A1A1A', '#4B5563', '#1E63B5', '#B53A6E', '#2E7D32', '#6E56CF'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mkRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function getDemoTrader(
  handle: string,
  opts?: { name?: string; color?: string; initial?: string },
): DemoTraderProfile {
  const bare = handle.replace(/^@/, '');
  const rng = mkRng(hash(handle || 'pointer'));
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  const portfolioUsd = 40_000 + rng() * 900_000;
  const pnl24hUsd = (0.05 + rng() * 0.3) * portfolioUsd;

  // Mostly-rising green series with light noise.
  const chart: number[] = [];
  let v = 0.28 + rng() * 0.12;
  for (let i = 0; i < 40; i++) {
    v += (rng() - 0.4) * 0.055;
    v = Math.max(0.05, Math.min(0.96, v));
    chart.push(v);
  }

  const usedClosed = new Set<string>();
  const mkPos = (closed: boolean, kind: 'token' | 'perp', big: boolean): TraderPosition => {
    let t = pick(POOL);
    let guard = 0;
    while (usedClosed.has(t.sym) && guard++ < 10) t = pick(POOL);
    usedClosed.add(t.sym);
    const valueUsd = big ? 60_000 + rng() * 260_000 : 1_000 + rng() * 20_000;
    const pnlPct = 15 + rng() * 510;
    const pnlUsd = valueUsd * (pnlPct / 100) * (closed ? 1 : 0.55);
    return {
      sym: t.sym,
      name: t.name,
      color: t.color,
      initial: t.initial,
      verified: rng() > 0.4,
      kind,
      closed,
      dateLabel: closed
        ? `${pick(MONTHS)} ${1 + Math.floor(rng() * 27)} at ${1 + Math.floor(rng() * 11)}:${String(
            Math.floor(rng() * 59),
          ).padStart(2, '0')} ${rng() > 0.5 ? 'AM' : 'PM'}`
        : undefined,
      heldAmount: closed ? undefined : valueUsd * (3 + rng() * 45),
      valueUsd,
      pnlUsd,
      pnlPct,
    };
  };

  const openCount = 4 + Math.floor(rng() * 4);
  const closedCount = 8 + Math.floor(rng() * 8);
  const open = Array.from({ length: openCount }, (_, i) =>
    mkPos(false, rng() > 0.85 ? 'perp' : 'token', i < 2),
  ).sort((a, b) => b.valueUsd - a.valueUsd);
  usedClosed.clear();
  const closed = Array.from({ length: closedCount }, (_, i) =>
    mkPos(true, rng() > 0.92 ? 'perp' : 'token', i < 3),
  ).sort((a, b) => b.pnlUsd - a.pnlUsd);

  const mutualN = Math.floor(rng() * 4); // 0–3
  const mutuals = Array.from({ length: mutualN }, () => ({ color: pick(MUTUAL_COLORS), initial: '' }));

  return {
    handle: handle.startsWith('@') ? handle : `@${bare}`,
    name: opts?.name ?? bare,
    color: opts?.color ?? pick(MUTUAL_COLORS),
    initial: opts?.initial ?? bare.charAt(0).toUpperCase(),
    xConnected: rng() > 0.25,
    following: 5 + Math.floor(rng() * 60),
    followers: 800 + Math.floor(rng() * 80_000),
    mutuals,
    avgHold: `${Math.floor(rng() * 12)}d ${Math.floor(rng() * 23)}h avg. hold`,
    trades: 20 + Math.floor(rng() * 600),
    joined: `Joined ${pick(MONTHS)} 2025`,
    portfolioUsd,
    pnl24hUsd,
    totalCashUsd: 500 + rng() * 12_000,
    chart,
    open,
    closed,
  };
}
