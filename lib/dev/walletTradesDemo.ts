/**
 * Client-side sample trades for the wallet-tracker feed preview (test UI while
 * live data is unavailable). Shape matches the real TrackerTrade so the feed
 * renders identically.
 */

/** The hovering wallet's aggregate position in THIS token (Axiom-style card). */
export type TokenPositionStats = {
  buysSol: number;
  buysUsd: number;
  buysCount: number;
  sellsSol: number;
  sellsUsd: number;
  sellsCount: number;
  pnlSol: number;
  pnlUsd: number;
  holdingUsd: number;
  holdingPct: number;
  holderSince: string;
};

export type DemoTrackerTrade = {
  signature: string;
  wallet: string;
  walletLabel: string | null;
  mint: string;
  symbol: string | null;
  name: string | null;
  imageUrl: string | null;
  side: 'buy' | 'sell';
  solAmount: number | null;
  usdAmount: number | null;
  marketCapUsd: number | null;
  blockTime: string | null;
  /** Age of the token itself (e.g. "22s", "6m") — shown next to the token. */
  tokenAgeLabel: string | null;
  tokenStats: TokenPositionStats;
};

const TRADERS = ['cupsey', 'west', 'euris', 'CENTED', 'orangie', 'waddles', 'jidn', 'assasin', 'gh0stee', 'kev', 'mrfrog', 'dv'];
const WALLETS = [
  '7xKq9fY2mNp8Lr3vQwEeThUiOoPaSdFgHjKlZxCvBnM',
  '3aB8TZRuJosgAsU9pLmNqRsTuVwXyZ1234567890abcd',
  '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump',
  'ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY',
  'Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump',
];
const TOKENS: Array<{ symbol: string; name: string; mint: string }> = [
  { symbol: 'RETARDIO', name: 'Retardio', mint: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN' },
  { symbol: 'FART', name: 'Fartcoin', mint: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump' },
  { symbol: 'MOODENG', name: 'Moo Deng', mint: 'ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY' },
  { symbol: 'CHILL', name: 'Chill Guy', mint: 'Df6yfrKC8kZE3KNkrHERKzAetSxbrWeniQfyJY4Jpump' },
  { symbol: 'PENGU', name: 'Pudgy Penguins', mint: '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv' },
  { symbol: 'GOAT', name: 'Goatseus', mint: 'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump' },
];

function pick<T>(arr: T[], i: number): T {
  return arr[((i % arr.length) + arr.length) % arr.length]!;
}

export function makeDemoTrackerTrade(seq: number, nowMs: number): DemoTrackerTrade {
  const tok = pick(TOKENS, seq * 3);
  const side: 'buy' | 'sell' = (seq * 7) % 3 === 0 ? 'sell' : 'buy';
  const sol = Number((0.05 + ((seq * 13) % 700) / 100).toFixed(seq % 2 ? 3 : 2));
  const usd = Math.round(sol * 168);
  const mc = [7_150, 5_040, 9_130, 90_900, 3_400_000, 82_800, 410_000][seq % 7] ?? 12_000;
  const ageSec = (seq % 12) * 6;

  // Deterministic per-(wallet,token) position stats for the hover card.
  const buysCount = 1 + (seq % 4);
  const sellsCount = seq % 3;
  const buysSol = Number((buysCount * (1.5 + ((seq * 11) % 60) / 20)).toFixed(3));
  const sellsSol = Number((sellsCount * (1.4 + ((seq * 7) % 60) / 20)).toFixed(3));
  const holdingSol = Number(Math.max(0, buysSol - sellsSol).toFixed(3));
  const pnlSol = Number((sellsSol - buysSol + holdingSol * (0.6 + ((seq % 9) / 10))).toFixed(3));
  const holderMin = 1 + (seq % 59);
  const tokenStats: TokenPositionStats = {
    buysSol,
    buysUsd: Math.round(buysSol * 168),
    buysCount,
    sellsSol,
    sellsUsd: Math.round(sellsSol * 168),
    sellsCount,
    pnlSol,
    pnlUsd: Math.round(pnlSol * 168),
    holdingUsd: Math.round(holdingSol * 168),
    holdingPct: Number(((holdingSol / Math.max(buysSol, 0.001)) * 100).toFixed(0)),
    holderSince: holderMin >= 60 ? `${Math.floor(holderMin / 60)}h` : `${holderMin}m`,
  };

  return {
    signature: `demo-${seq}-${nowMs}`,
    wallet: pick(WALLETS, seq),
    walletLabel: pick(TRADERS, seq),
    mint: tok.mint,
    symbol: tok.symbol,
    name: tok.name,
    imageUrl: `https://picsum.photos/seed/pt-trade-${tok.symbol}/64`,
    side,
    solAmount: sol,
    usdAmount: usd,
    marketCapUsd: mc,
    blockTime: new Date(nowMs - ageSec * 1000).toISOString(),
    tokenAgeLabel: (() => {
      const m = 1 + ((seq * 5) % 30);
      return m >= 60 ? `${Math.floor(m / 60)}h` : `${m}m`;
    })(),
    tokenStats,
  };
}

export function seedDemoTrackerTrades(nowMs: number): DemoTrackerTrade[] {
  return Array.from({ length: 14 }, (_, i) => makeDemoTrackerTrade(i + 1, nowMs));
}
