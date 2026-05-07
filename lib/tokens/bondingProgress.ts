import type { Json } from '@/lib/supabase/types';
import type { PulseTokenBundle } from '@/types/tokens';

/** Bonding % at or above this uses the “final stretch” (blue) ring treatment. */
export const PULSE_NEAR_MIGRATE_PCT = 85;

export type PulseBondingRingState = {
  /** 0-100 when known; null if not present in metadata. */
  fillPct: number | null;
  /** True when the token row has migrated (bonding curve complete). */
  migrated: boolean;
};

function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Axiom-style F: often 0-10 scale (9.7 -> 97%); values below 1 can be fraction (0.028 -> 2.8%).
 * (10, 100] treated as direct percent.
 */
function normalizeAxiomF(fRaw: number): number {
  if (fRaw <= 0) return 0;
  if (fRaw > 100) return 100;
  if (fRaw > 10) return Math.min(100, fRaw);
  if (fRaw >= 1) return Math.min(100, fRaw * 10);
  return Math.min(100, fRaw * 100);
}

function pctFromUnknown(v: unknown): number | null {
  const n = asNum(v);
  if (n == null) return null;
  if (n >= 0 && n <= 100) return n;
  if (n > 0 && n <= 1) return n * 100;
  return null;
}

/** DFS for bonding / F (fill %) in Helius DAS blobs, snapshot JSON, NFT attributes. */
function walkForFillPct(obj: unknown, depth: number): number | null {
  if (depth > 14 || obj == null) return null;
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    const r = obj as Record<string, unknown>;
    const fRaw = asNum(r.F) ?? asNum(r.f);
    if (fRaw != null && fRaw >= 0 && Number.isFinite(fRaw)) {
      return normalizeAxiomF(fRaw);
    }
    for (const key of [
      'bondingCurveProgress',
      'bonding_curve_progress',
      'curve_progress',
      'bonding_progress',
      'pctFilled',
      'pct_filled',
      'fillPct',
      'fill_pct',
      'curveProgress',
    ]) {
      const p = pctFromUnknown(r[key]);
      if (p != null) return p;
    }
    for (const v of Object.values(r)) {
      const hit = walkForFillPct(v, depth + 1);
      if (hit != null) return hit;
    }
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const o = item as Record<string, unknown>;
        if (typeof o.trait_type === 'string') {
          const t = o.trait_type.toLowerCase();
          if (t === 'f') {
            const n = asNum(o.value);
            if (n != null && Number.isFinite(n)) return normalizeAxiomF(n);
          }
          if (
            t.includes('fill') ||
            t.includes('bonding') ||
            t.includes('curve') ||
            t.includes('migrate')
          ) {
            const p = pctFromUnknown(o.value);
            if (p != null) return p;
          }
        }
      }
      const hit = walkForFillPct(item, depth + 1);
      if (hit != null) return hit;
    }
  }
  return null;
}

export function getPulseBondingRingState(bundle: PulseTokenBundle): PulseBondingRingState {
  const { token, snapshot } = bundle;
  if (token.migrated_at) {
    return { fillPct: 100, migrated: true };
  }
  const raw = token.raw_metadata as Json | null;
  const fromToken = raw != null ? walkForFillPct(raw, 0) : null;
  if (fromToken != null) return { fillPct: fromToken, migrated: false };

  const em = snapshot?.extended_metrics;
  const fromSnap = em != null ? walkForFillPct(em, 0) : null;
  return { fillPct: fromSnap, migrated: false };
}
