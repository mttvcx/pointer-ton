/**
 * DEMO COPY-TRADE DATA — the social activity feed ("@trader bought $TOKEN") and
 * the per-token trader list ("who's in this token and how they're doing").
 *
 * FOMO's copy model is COPY not MIRROR: nothing auto-fires. These fixtures feed
 * the surfaces where the user *taps to copy* — the Social activity feed and the
 * token screen. Deterministic (seeded, no Math.random) so a given event/token
 * always renders the same numbers across renders. Each event carries a real demo
 * PulseBundle so the Copy button can open the BuySheet with a valid token.
 *
 * Swap getActivityFeed() for a live "followed-trader trades" stream and
 * getTradersOnToken() for a real per-token positions endpoint when the backend
 * ships them.
 */

import type { PulseBundle } from '../types';
import { getDemoPulse } from './pulseDemo';
import { LEADERBOARD, ONBOARD_TRADERS } from '../demo';

export type Trader = { handle: string; name: string; color: string; initial: string; xConnected: boolean };

export type TradeEvent = {
  id: string;
  trader: Trader;
  side: 'buy' | 'sell';
  bundle: PulseBundle;
  amountUsd: number;
  /** Realized P&L % on a sell; null for buys. */
  pnlPct: number | null;
  ageMins: number;
  ago: string;
};

export type TokenTrader = Trader & {
  avgEntryUsd: number;
  pnlPct: number;
  holdingUsd: number;
  heldLabel: string;
};

/* ---- seeded RNG (matches src/demo/traders.ts) ---- */
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

function ago(mins: number): string {
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Trader pool drawn from the leaderboard + onboarding lists so following a
 *  trader you saw there surfaces their activity here (handles line up). */
const TRADERS: Trader[] = (() => {
  const seen = new Set<string>();
  const out: Trader[] = [];
  for (const t of [...LEADERBOARD, ...ONBOARD_TRADERS]) {
    if (seen.has(t.handle)) continue;
    seen.add(t.handle);
    const rng = mkRng(hash(t.handle));
    out.push({ handle: t.handle, name: t.name, color: t.color, initial: t.initial, xConnected: rng() > 0.3 });
  }
  return out;
})();

/** Token pool — graduated + nearly-bonded demo coins (real snapshot prices). */
const TOKENS: PulseBundle[] = [...getDemoPulse('migrated'), ...getDemoPulse('stretch')];

/**
 * The live copy-trade feed. Events are ordered newest → oldest with strictly
 * increasing ages so the list reads like a real-time tape.
 */
export function getActivityFeed(): TradeEvent[] {
  const out: TradeEvent[] = [];
  let ageMins = 0;
  for (let i = 0; i < 26; i++) {
    const rng = mkRng(hash(`activity-${i}`));
    const trader = TRADERS[Math.floor(rng() * TRADERS.length)] ?? TRADERS[0];
    const bundle = TOKENS[Math.floor(rng() * TOKENS.length)] ?? TOKENS[0];
    const side: 'buy' | 'sell' = rng() > 0.72 ? 'sell' : 'buy';
    const big = rng() > 0.82;
    const amountUsd = Math.round(big ? 8_000 + rng() * 90_000 : 120 + rng() * 6_000);
    const pnlPct = side === 'sell' ? Math.round((rng() * 480 - 40) * 10) / 10 : null;
    ageMins += i === 0 ? Math.floor(rng() * 2) : 1 + Math.floor(rng() * 16);
    out.push({ id: `ev-${i}`, trader, side, bundle, amountUsd, pnlPct, ageMins, ago: ago(ageMins) });
  }
  return out;
}

/** Traders currently positioned in a given token (profitability visibility +
 *  chart overlays + per-token Copy). Deterministic per mint. */
export function getTradersOnToken(mint: string, currentPrice: number): TokenTrader[] {
  const price = currentPrice > 0 ? currentPrice : 0.0001;
  const rng = mkRng(hash(`ontoken-${mint}`));
  const count = 3 + Math.floor(rng() * 2); // 3–4
  const used = new Set<string>();
  const out: TokenTrader[] = [];
  for (let i = 0; i < count; i++) {
    let t = TRADERS[Math.floor(rng() * TRADERS.length)] ?? TRADERS[0];
    let guard = 0;
    while (used.has(t.handle) && guard++ < 8) t = TRADERS[Math.floor(rng() * TRADERS.length)] ?? TRADERS[0];
    used.add(t.handle);
    const avgEntryUsd = price * (0.18 + rng() * 0.66); // entered below current → up
    const pnlPct = Math.round((price / avgEntryUsd - 1) * 1000) / 10;
    const holdingUsd = Math.round(600 + rng() * 44_000);
    const held = Math.floor(rng() * 6);
    const hh = Math.floor(rng() * 23);
    out.push({
      ...t,
      avgEntryUsd,
      pnlPct,
      holdingUsd,
      heldLabel: held > 0 ? `${held}d ${hh}h` : `${hh}h`,
    });
  }
  return out.sort((a, b) => b.holdingUsd - a.holdingUsd);
}
