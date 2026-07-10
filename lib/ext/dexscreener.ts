/**
 * DexScreener token lookup — the extension's cross-chain market source. Covers
 * every chain (Solana + all EVM) with no API key, so it powers both the EVM token
 * card AND the token-vs-wallet decision: a real token has DEX pairs, a wallet
 * doesn't. Read-only, best-effort, always times out.
 */

export interface DexTokenData {
  /** DexScreener chain id: "solana" | "ethereum" | "base" | "bsc" | "arbitrum" | … */
  chain: string;
  address: string;
  symbol: string | null;
  name: string | null;
  iconUrl: string | null;
  priceUsd: number | null;
  change24hPct: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  ageDays: number | null;
  pairUrl: string | null;
}

interface DexPair {
  chainId?: string;
  url?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  priceChange?: { h24?: number };
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number.parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * Look up an address on DexScreener and return the deepest-liquidity pair as
 * normalized market data, or null when it isn't a traded token (i.e. a wallet).
 * `preferChain` biases pair selection when the same address trades on many chains.
 */
export async function dexscreenerToken(
  address: string,
  preferChain?: string,
): Promise<DexTokenData | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(address)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { pairs?: DexPair[] };
    const pairs = Array.isArray(json.pairs) ? json.pairs : [];
    if (pairs.length === 0) return null;

    // Deepest-liquidity pair wins; bias toward preferChain if one is given.
    const scored = pairs
      .filter((p) => p.baseToken?.address?.toLowerCase() === address.toLowerCase() || !p.baseToken?.address)
      .sort((a, b) => {
        const bias = (p: DexPair) => (preferChain && p.chainId === preferChain ? 1e15 : 0);
        return (num(b.liquidity?.usd) ?? 0) + bias(b) - ((num(a.liquidity?.usd) ?? 0) + bias(a));
      });
    const best = scored[0] ?? pairs[0];
    if (!best) return null;

    const createdAt = typeof best.pairCreatedAt === 'number' ? best.pairCreatedAt : null;
    const ageDays = createdAt ? Math.max(0, (Date.now() - createdAt) / 86_400_000) : null;

    return {
      chain: best.chainId ?? 'unknown',
      address,
      symbol: best.baseToken?.symbol ?? null,
      name: best.baseToken?.name ?? null,
      iconUrl: best.info?.imageUrl ?? null,
      priceUsd: num(best.priceUsd),
      change24hPct: num(best.priceChange?.h24),
      marketCapUsd: num(best.marketCap) ?? num(best.fdv),
      liquidityUsd: num(best.liquidity?.usd),
      volume24hUsd: num(best.volume?.h24),
      ageDays,
      pairUrl: best.url ?? null,
    };
  } catch {
    return null;
  }
}
