/**
 * "Top Holder" credentials — for a wallet, which tokens it ranks as a top holder of.
 * Populated as a data-flywheel capture tap (see lib/db/topHoldings.ts): every time
 * we resolve a token's holders (ranked by balance) we snapshot the top N into
 * wallet_top_holdings, building a reverse index of who's a top holder of what.
 */

export type TopHolderTier = 'top10' | 'top50' | 'top100';

export interface TopHolderCredential {
  mint: string;
  symbol: string;
  /** 1-based rank in the token's holder list at capture time. */
  rank: number;
  tier: TopHolderTier;
  /** ISO — when this ranking was last observed. */
  capturedAt?: string | null;
}

/** Bucket a raw rank into a tier. Returns null for ranks outside the top 100. */
export function tierForRank(rank: number): TopHolderTier | null {
  if (!Number.isFinite(rank) || rank <= 0) return null;
  if (rank <= 10) return 'top10';
  if (rank <= 50) return 'top50';
  if (rank <= 100) return 'top100';
  return null;
}

/** The threshold number shown in the pill ("Top 10" / "Top 50" / "Top 100"). */
export function tierThreshold(tier: TopHolderTier): 10 | 50 | 100 {
  return tier === 'top10' ? 10 : tier === 'top50' ? 50 : 100;
}

/** "FWOG Top 10" — symbol is upper-cased and stripped of a leading $. */
export function formatTopHolderLabel(c: TopHolderCredential): string {
  const sym = c.symbol.replace(/^\$/, '').toUpperCase();
  return `${sym} Top ${tierThreshold(c.tier)}`;
}

const TIER_WEIGHT: Record<TopHolderTier, number> = { top10: 0, top50: 1, top100: 2 };

/** Elite first: tighter tier, then lower rank. */
export function sortTopHolderCredentials(list: TopHolderCredential[]): TopHolderCredential[] {
  return [...list].sort(
    (a, b) => TIER_WEIGHT[a.tier] - TIER_WEIGHT[b.tier] || a.rank - b.rank,
  );
}

/** Compact one-liner for inline feed badges: "$FWOG, $CHILLGUY +3". */
export function compactTopHolderSummary(list: TopHolderCredential[], maxNames = 2): string {
  const sorted = sortTopHolderCredentials(list);
  const names = sorted.slice(0, maxNames).map((c) => `$${c.symbol.replace(/^\$/, '').toUpperCase()}`);
  const extra = sorted.length - names.length;
  return extra > 0 ? `${names.join(', ')} +${extra}` : names.join(', ');
}

// ── Deterministic demo (UI demo mode only) ──────────────────────────────
// Mirrors mockWalletWideStats' FNV hash so the same address always yields the
// same credentials. NEVER used in live mode — real data comes from the API.

const DEMO_TOKENS: Array<{ mint: string; symbol: string }> = [
  { mint: 'FWoGuvMuxwWTv95NEd2jVBTx3f9wKPPYr7YkQ8Rz9', symbol: 'FWOG' },
  { mint: 'A8C3xuqscfmyLrte3VmTqrAq8kgMASF4pR44H5Ry2n', symbol: 'CHILLGUY' },
  { mint: '5z3EqYQo9HiCEs3R84RCDMu2n7anpDMxRhdK8PSWmrRC', symbol: 'PONKE' },
  { mint: 'GR8YB1eXjPRHdr4mZNvj8SdU4iAThpqmfCDGxxp8Rz8', symbol: 'ACT' },
  { mint: 'zebeczgi5fSEtbpfQKVZKCJ3WgYXxjkMUkNNx7fLKAF', symbol: 'ZBCN' },
  { mint: 'MELAqSxAxi7DfgYFsBFjK4Yxj3xTz9jJ3xk5b6t1nQ2', symbol: 'MELANIA' },
  { mint: 'So11111111111111111111111111111111111111112', symbol: 'BONK' },
];

export function mockTopHoldings(address: string): TopHolderCredential[] {
  let h = 2166136261;
  for (let i = 0; i < address.length; i++) {
    h ^= address.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = Math.abs(h);
  const count = 1 + (u % 5); // 1–5 credentials
  const out: TopHolderCredential[] = [];
  for (let i = 0; i < count; i++) {
    const tok = DEMO_TOKENS[(u + i * 7) % DEMO_TOKENS.length]!;
    const rank = 1 + ((u >> (i + 1)) % 100);
    const tier = tierForRank(rank);
    if (!tier) continue;
    if (out.some((c) => c.mint === tok.mint)) continue;
    out.push({ mint: tok.mint, symbol: tok.symbol, rank, tier });
  }
  // Guarantee at least one elite credential so the demo always shows the gold tier.
  if (!out.some((c) => c.tier === 'top10')) {
    const tok = DEMO_TOKENS[u % DEMO_TOKENS.length]!;
    out.unshift({ mint: tok.mint, symbol: tok.symbol, rank: 1 + (u % 10), tier: 'top10' });
  }
  return sortTopHolderCredentials(out);
}
