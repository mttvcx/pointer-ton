import type { PackType } from '@/types/pack';

/** Trader-friendly SOL denominations for pack prices. */
export const CLEAN_SOL_AMOUNTS: readonly number[] = [
  0.05, 0.075, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5,
  10, 12.5, 15, 20,
] as const;

export type PackUsdBand = {
  targetUsd: number;
  minUsd: number;
  maxUsd: number;
  maxSol: number;
};

export const PACK_USD_BANDS: Record<PackType, PackUsdBand> = {
  bronze: { targetUsd: 10, minUsd: 5, maxUsd: 20, maxSol: 0.25 },
  silver: { targetUsd: 35, minUsd: 20, maxUsd: 60, maxSol: 1 },
  gold: { targetUsd: 150, minUsd: 100, maxUsd: 250, maxSol: 3 },
  diamond: { targetUsd: 270, minUsd: 200, maxUsd: 450, maxSol: 6 },
  legendary: { targetUsd: 400, minUsd: 250, maxUsd: 600, maxSol: 7.5 },
};

export type SolUsdQuote = {
  solUsd: number;
  source: 'live' | 'fallback';
};

const JUP_SOL_MINT = 'So11111111111111111111111111111111111111112';

export function getFallbackSolUsd(): number {
  const raw = process.env.NEXT_PUBLIC_FALLBACK_SOL_USD;
  const n = Number(raw ?? 72);
  return Number.isFinite(n) && n > 0 ? n : 72;
}

async function fetchLiveSolUsd(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.jup.ag/price/v2?ids=${JUP_SOL_MINT}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Record<string, { price?: string }>;
    };
    const p = Number(json.data?.[JUP_SOL_MINT]?.price);
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}

/** Live Jupiter SOL/USD when available; otherwise configured fallback (never silent zero). */
export async function getSolUsdPrice(): Promise<SolUsdQuote> {
  const live = await fetchLiveSolUsd();
  if (live != null) return { solUsd: live, source: 'live' };
  return { solUsd: getFallbackSolUsd(), source: 'fallback' };
}

/**
 * Snap to the nearest allowed clean SOL amount.
 * When `maxSol` is set, never return a value above it (pick largest clean amount ≤ maxSol if needed).
 */
export function roundToCleanSolAmount(rawSol: number, maxSol?: number): number {
  if (!Number.isFinite(rawSol) || rawSol <= 0) {
    return CLEAN_SOL_AMOUNTS[0]!;
  }

  const cap = maxSol != null && Number.isFinite(maxSol) ? maxSol : Infinity;
  const allowed = CLEAN_SOL_AMOUNTS.filter((a) => a <= cap + 1e-9);
  if (allowed.length === 0) {
    return CLEAN_SOL_AMOUNTS.filter((a) => a <= cap).at(-1) ?? CLEAN_SOL_AMOUNTS[0]!;
  }

  let best = allowed[0]!;
  let bestDist = Math.abs(rawSol - best);
  for (const a of allowed) {
    const dist = Math.abs(rawSol - a);
    if (dist < bestDist - 1e-9 || (Math.abs(dist - bestDist) < 1e-9 && a < best)) {
      best = a;
      bestDist = dist;
    }
  }
  return best;
}

/** USD-target price converted to a clean SOL amount within tier bands. */
export function computeDynamicPackPrice(packType: PackType, solUsd: number): number {
  const band = PACK_USD_BANDS[packType];
  const rate = solUsd > 0 ? solUsd : getFallbackSolUsd();
  const targetSol = band.targetUsd / rate;
  const minSol = band.minUsd / rate;
  const maxSolFromUsd = band.maxUsd / rate;
  const upper = Math.min(band.maxSol, maxSolFromUsd);
  const clamped = Math.min(Math.max(targetSol, minSol), upper);
  return roundToCleanSolAmount(clamped, band.maxSol);
}

export type PackPriceSnapshotEntry = {
  packPriceSol: number;
  approximateUsd: number;
  rawTargetSol: number;
  solUsd: number;
};

export type PackPriceSnapshot = {
  solUsd: number;
  source: 'live' | 'fallback';
  packs: Record<PackType, PackPriceSnapshotEntry>;
};

export function getPackPriceSnapshot(solUsd: number): PackPriceSnapshot {
  const rate = solUsd > 0 ? solUsd : getFallbackSolUsd();
  const packs = {} as Record<PackType, PackPriceSnapshotEntry>;
  const types: PackType[] = ['bronze', 'silver', 'gold', 'diamond', 'legendary'];
  for (const type of types) {
    const band = PACK_USD_BANDS[type];
    const rawTargetSol = band.targetUsd / rate;
    const packPriceSol = computeDynamicPackPrice(type, rate);
    packs[type] = {
      packPriceSol,
      approximateUsd: packPriceSol * rate,
      rawTargetSol,
      solUsd: rate,
    };
  }
  return {
    solUsd: rate,
    source: 'live',
    packs,
  };
}

export function approximateUsdFromSol(packPriceSol: number, solUsd: number): number {
  return packPriceSol * (solUsd > 0 ? solUsd : getFallbackSolUsd());
}
