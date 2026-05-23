import type { PulseTokenBundle } from '@/types/tokens';

/** When top 10 hold ≥ this % of supply, treat as overly concentrated (bad). */
export const AXIOM_TOP10_BAD_PCT = 42;
/** Dev sold down to ≤ this % — funding / dump risk (bad). */
export const AXIOM_DEV_SOLD_BAD_MAX_PCT = 5;
/** Dev still holds ≥ this % — insider-heavy float (bad). */
export const AXIOM_DEV_HIGH_BAD_MIN_PCT = 68;
/** Reported sniper / bundle / cluster allocation ≥ this % reads as excessive (bad). */
export const AXIOM_ALLOCATION_BAD_PCT = 10;

export type AxiomSpriteMetrics = {
  /** Person + star — maps to top-10 holder concentration. */
  top10Pct: number | null;
  /** Chef hat — developer holding. */
  devPct: number | null;
  /** Crosshair — sniper-style allocation when present in payload JSON. */
  sniperPct: number | null;
  /** Triple circles — bundled / banded allocation when present. */
  bundlePct: number | null;
  /** Tombstone — cluster / linked-wallet style signals when present. */
  clusterPct: number | null;
};

function coercePctLike(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v >= 0 && v <= 100) return v;
    if (v > 0 && v <= 1) return v * 100;
    return null;
  }
  if (typeof v === 'string') {
    const t = v.trim().replace(/%/g, '');
    if (t === '') return null;
    const n = Number(t);
    return coercePctLike(n);
  }
  return null;
}

function walkForKeyPatterns(obj: unknown, patterns: RegExp[], depth: number): number | null {
  if (depth > 14 || obj == null) return null;
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    const r = obj as Record<string, unknown>;
    for (const [k, v] of Object.entries(r)) {
      if (patterns.some((p) => p.test(k))) {
        const n = coercePctLike(v);
        if (n != null) return n;
      }
      const sub = walkForKeyPatterns(v, patterns, depth + 1);
      if (sub != null) return sub;
    }
    return null;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const sub = walkForKeyPatterns(item, patterns, depth + 1);
      if (sub != null) return sub;
    }
  }
  return null;
}

export function getAxiomSpriteMetrics(bundle: PulseTokenBundle): AxiomSpriteMetrics {
  const snap = bundle.snapshot;
  const roots = [snap?.extended_metrics, bundle.token.raw_metadata].filter(
    (x): x is NonNullable<typeof x> => x != null,
  );

  const walk = (patterns: RegExp[]): number | null => {
    for (const root of roots) {
      const hit = walkForKeyPatterns(root, patterns, 0);
      if (hit != null) return hit;
    }
    return null;
  };

  const top10 =
    snap?.top10_holder_pct != null && Number.isFinite(snap.top10_holder_pct)
      ? snap.top10_holder_pct
      : null;
  const dev =
    snap?.dev_holding_pct != null && Number.isFinite(snap.dev_holding_pct)
      ? snap.dev_holding_pct
      : null;

  return {
    top10Pct: top10,
    devPct: dev,
    sniperPct: walk([/sniper|snipe/i]),
    bundlePct: walk([/bundle|bundled/i]),
    clusterPct: walk([/cluster|linked|insider|fresh|related|hive/i]),
  };
}

export function formatAxiomPctCell(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${Math.round(Math.min(100, Math.max(0, n)))}%`;
}

export type AxiomSpriteBadFlags = {
  top10: boolean;
  dev: boolean;
  sniper: boolean;
  bundle: boolean;
  cluster: boolean;
};

/**
 * Red glyphs + rose numerals when concentration / insider metrics cross terminal-style thresholds.
 */
export function getAxiomSpriteBadFlags(m: AxiomSpriteMetrics): AxiomSpriteBadFlags {
  const top10Bad = m.top10Pct != null && m.top10Pct >= AXIOM_TOP10_BAD_PCT;
  const devBad =
    (m.devPct != null && m.devPct <= AXIOM_DEV_SOLD_BAD_MAX_PCT) ||
    (m.devPct != null && m.devPct >= AXIOM_DEV_HIGH_BAD_MIN_PCT);
  const sniperBad = m.sniperPct != null && m.sniperPct >= AXIOM_ALLOCATION_BAD_PCT;
  const bundleBad = m.bundlePct != null && m.bundlePct >= AXIOM_ALLOCATION_BAD_PCT;
  const clusterBad = m.clusterPct != null && m.clusterPct >= AXIOM_ALLOCATION_BAD_PCT;

  return {
    top10: top10Bad,
    dev: devBad,
    sniper: sniperBad,
    bundle: bundleBad,
    cluster: clusterBad,
  };
}
