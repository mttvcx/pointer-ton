import { PublicKey } from '@solana/web3.js';
import { bondingCurvePda, canonicalPumpPoolPda } from '@pump-fun/pump-sdk';
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

const DEX_SCREENER_BASE = 'https://api.dexscreener.com/latest/dex/tokens';

async function fetchBestDexPair(mint: string): Promise<{
  pairAddress: string;
  dexId: string | null;
} | null> {
  try {
    const res = await fetch(`${DEX_SCREENER_BASE}/${encodeURIComponent(mint)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as DexLatestResponse;
    const best = pickBestDexPair(json.pairs ?? [], mint);
    if (best?.pairAddress?.trim()) {
      return {
        pairAddress: best.pairAddress.trim(),
        dexId: best.dexId ?? null,
      };
    }
  } catch {
    /* dex optional */
  }
  return null;
}

/**
 * Resolve Helius backfill targets for an arbitrary mint. Same engine as the
 * QA-mint resolver but without the QA-only gate.
 *
 * Returns at minimum the pump-sdk bonding curve and canonical pool PDAs, plus
 * the mint address itself, and prepends a DexScreener pair when one is found.
 */
export async function resolveIndexerTargets(mint: string): Promise<{
  mint: string;
  targets: IndexerAddressTarget[];
  primary: IndexerAddressTarget | null;
}> {
  const normalized = mint.trim();
  if (!normalized) throw new Error('resolveIndexerTargets: empty mint');

  // Pump-sdk PDAs throw for non-pump mints — try/catch and skip in that case.
  const targets: IndexerAddressTarget[] = [];
  try {
    const pk = new PublicKey(normalized);
    const bonding = bondingCurvePda(pk).toBase58();
    const canonicalPool = canonicalPumpPoolPda(pk).toBase58();
    targets.push(
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
    );
  } catch {
    /* non-pump mint — skip PDA targets */
  }

  targets.push({
    address: normalized,
    kind: 'mint',
    reason: 'mint address — early transfers / metadata txs fallback',
  });

  const dex = await fetchBestDexPair(normalized);
  if (dex) {
    targets.unshift({
      address: dex.pairAddress,
      kind: 'dex_pair',
      reason: `DexScreener best pair (${dex.dexId ?? 'unknown'}) — live swap history`,
    });
  }

  const primary =
    targets.find((t) => t.kind === 'dex_pair') ??
    targets.find((t) => t.kind === 'canonical_pool') ??
    targets.find((t) => t.kind === 'bonding_curve') ??
    targets[0] ??
    null;

  return { mint: normalized, targets, primary };
}
