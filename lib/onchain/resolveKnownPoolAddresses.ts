import 'server-only';

import { PublicKey } from '@solana/web3.js';
import { bondingCurvePda, canonicalPumpPoolPda } from '@pump-fun/pump-sdk';
import { inferMintKind } from '@/lib/chains/mintKind';
import { getPointerQaMint, isPointerQaMint } from '@/lib/qa/pointerQaMint';
import type { PoolWalletRole } from '@/lib/onchain/poolWalletTypes';

export type { PoolWalletRole };

export type KnownPoolContext = {
  /** Pool / vault / curve addresses for this mint. */
  addresses: Set<string>;
  /** Address → role for desk labeling. */
  roles: Map<string, PoolWalletRole>;
  /** Primary PumpSwap pair (DexScreener) when migrated. */
  primaryDexPair: string | null;
};

type DexLatestResponse = {
  pairs?: {
    pairAddress?: string;
    dexId?: string;
    baseToken?: { address?: string };
    liquidity?: { usd?: number };
    volume?: { h24?: number };
  }[];
};

function pickBestDexPair(pairs: NonNullable<DexLatestResponse['pairs']>, mint: string) {
  const matching = pairs.filter((p) => p.baseToken?.address?.trim() === mint);
  if (matching.length === 0) return null;
  return [...matching].sort((a, b) => {
    const la = Number(a.liquidity?.usd) || 0;
    const lb = Number(b.liquidity?.usd) || 0;
    if (lb !== la) return lb - la;
    return (Number(b.volume?.h24) || 0) - (Number(a.volume?.h24) || 0);
  })[0]!;
}

const poolCache = new Map<string, { ctx: KnownPoolContext; at: number }>();
const CACHE_MS = 5 * 60_000;

/**
 * Known pump LP / bonding-curve / Dex pair addresses for holder + trade labeling.
 * Cached 5m per mint.
 */
export async function resolveKnownPoolAddresses(mint: string): Promise<KnownPoolContext> {
  const key = mint.trim();
  const hit = poolCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.ctx;

  const addresses = new Set<string>();
  const roles = new Map<string, PoolWalletRole>();
  let primaryDexPair: string | null = null;

  if (inferMintKind(key) === 'sol' && key.endsWith('pump')) {
    try {
      const pk = new PublicKey(key);
      const bonding = bondingCurvePda(pk).toBase58();
      const canonical = canonicalPumpPoolPda(pk).toBase58();
      addresses.add(bonding);
      addresses.add(canonical);
      roles.set(bonding, 'bonding_curve');
      roles.set(canonical, 'lp');
    } catch {
      /* invalid mint */
    }
  }

  if (isPointerQaMint(key)) {
    const envPool = process.env.POINTER_QA_INDEXER_POOL?.trim();
    if (envPool) {
      addresses.add(envPool);
      roles.set(envPool, 'lp');
      primaryDexPair = envPool;
    }
  }

  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(key)}`,
      { cache: 'no-store', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) },
    );
    if (res.ok) {
      const json = (await res.json()) as DexLatestResponse;
      const best = pickBestDexPair(json.pairs ?? [], key);
      if (best?.pairAddress?.trim()) {
        const pair = best.pairAddress.trim();
        addresses.add(pair);
        roles.set(pair, 'lp');
        primaryDexPair = pair;
      }
    }
  } catch {
    /* dex optional */
  }

  const ctx: KnownPoolContext = { addresses, roles, primaryDexPair };
  poolCache.set(key, { ctx, at: Date.now() });
  return ctx;
}

/** QA mint pool hint for indexer parser (env override → Dex pair). */
export function qaIndexerPoolHint(): string | null {
  const env = process.env.POINTER_QA_INDEXER_POOL?.trim();
  if (env) return env;
  if (isPointerQaMint(getPointerQaMint())) {
    return process.env.POINTER_QA_INDEXER_POOL?.trim() ?? null;
  }
  return null;
}
