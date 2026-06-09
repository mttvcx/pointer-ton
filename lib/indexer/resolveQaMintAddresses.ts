import { PublicKey } from '@solana/web3.js';
import { bondingCurvePda, canonicalPumpPoolPda } from '@pump-fun/pump-sdk';
import { getPointerQaMintClient, isPointerQaMintClient } from '@/lib/qa/pointerQaMintClient';
import type { IndexerAddressTarget } from '@/lib/indexer/types';

type DexLatestResponse = {
  pairs?: {
    pairAddress?: string;
    dexId?: string;
    baseToken?: { address?: string };
    liquidity?: { usd?: number };
    volume?: { h24?: number };
  }[];
};

function pickBestDexPair(
  pairs: NonNullable<DexLatestResponse['pairs']>,
  mint: string,
) {
  const matching = pairs.filter((p) => p.baseToken?.address?.trim() === mint);
  if (matching.length === 0) return null;
  return [...matching].sort((a, b) => {
    const la = Number(a.liquidity?.usd) || 0;
    const lb = Number(b.liquidity?.usd) || 0;
    if (lb !== la) return lb - la;
    return (Number(b.volume?.h24) || 0) - (Number(a.volume?.h24) || 0);
  })[0]!;
}

/**
 * Resolve Helius backfill targets for the QA mint.
 * Primary for migrated pump tokens: DexScreener PumpSwap pair (most swap sigs).
 */
export async function resolveQaMintIndexerTargets(mint?: string): Promise<{
  mint: string;
  targets: IndexerAddressTarget[];
  primary: IndexerAddressTarget | null;
}> {
  const qaMint = mint?.trim() || getPointerQaMintClient();
  if (!isPointerQaMintClient(qaMint)) {
    throw new Error(`resolveQaMintIndexerTargets: mint ${qaMint} is not QA mint`);
  }

  const pk = new PublicKey(qaMint);
  const bonding = bondingCurvePda(pk).toBase58();
  const canonicalPool = canonicalPumpPoolPda(pk).toBase58();

  const targets: IndexerAddressTarget[] = [
    {
      address: bonding,
      kind: 'bonding_curve',
      reason: 'pump-sdk bondingCurvePda — pre-migration curve account',
    },
    {
      address: canonicalPool,
      kind: 'canonical_pool',
      reason: 'pump-sdk canonicalPumpPoolPda — PumpSwap canonical pool PDA',
    },
    {
      address: qaMint,
      kind: 'mint',
      reason: 'mint address — early transfers / metadata txs fallback',
    },
  ];

  let dexPair: string | null = null;
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(qaMint)}`,
      { cache: 'no-store', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8_000) },
    );
    if (res.ok) {
      const json = (await res.json()) as DexLatestResponse;
      const best = pickBestDexPair(json.pairs ?? [], qaMint);
      if (best?.pairAddress?.trim()) {
        dexPair = best.pairAddress.trim();
        targets.unshift({
          address: dexPair,
          kind: 'dex_pair',
          reason: `DexScreener best pair (${best.dexId ?? 'unknown'}) — live PumpSwap swap history`,
        });
      }
    }
  } catch {
    /* dex optional */
  }

  const primary =
    targets.find((t) => t.kind === 'dex_pair') ??
    targets.find((t) => t.kind === 'canonical_pool') ??
    targets[0] ??
    null;

  return { mint: qaMint, targets, primary };
}
