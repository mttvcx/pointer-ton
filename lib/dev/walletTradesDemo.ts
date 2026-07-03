/**
 * Client-side sample trades for the wallet-tracker feed preview (test UI while
 * live data is unavailable). Shape matches the real TrackerTrade so the feed
 * renders identically.
 */

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
  };
}

export function seedDemoTrackerTrades(nowMs: number): DemoTrackerTrade[] {
  return Array.from({ length: 14 }, (_, i) => makeDemoTrackerTrade(i + 1, nowMs));
}
