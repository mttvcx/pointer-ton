/** Best-effort walks for supply / fee hints from Helius DAS / snapshot JSON. */

function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(/[, _]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Returns a UI string like "1B" / "1.2M" or null. */
export function formatSupplyHint(raw: number | null): string | null {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
  if (raw >= 1e9) return `${(raw / 1e9).toFixed(raw >= 1e10 ? 0 : 2)}B`;
  if (raw >= 1e6) return `${(raw / 1e6).toFixed(raw >= 1e7 ? 0 : 2)}M`;
  if (raw >= 1e3) return `${(raw / 1e3).toFixed(1)}K`;
  return String(Math.round(raw));
}

export function extractSupplyTokens(metadata: unknown): number | null {
  if (metadata == null) return null;
  const keys = [
    'supply',
    'total_supply',
    'totalSupply',
    'max_supply',
    'maxSupply',
    'circulating_supply',
    'circulatingSupply',
    'uiAmount',
    'ui_amount',
  ];
  const walk = (obj: unknown, depth: number): number | null => {
    if (depth > 12 || obj == null) return null;
    if (typeof obj === 'object' && !Array.isArray(obj)) {
      const r = obj as Record<string, unknown>;
      for (const k of keys) {
        const n = asNum(r[k]);
        if (n != null && n > 0) return n;
      }
      for (const v of Object.values(r)) {
        const h = walk(v, depth + 1);
        if (h != null) return h;
      }
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const h = walk(item, depth + 1);
        if (h != null) return h;
      }
    }
    return null;
  };
  return walk(metadata, 0);
}

/** SOL spent on global / pool fees when indexer provides it (best-effort). */
export function extractGlobalFeesSol(extendedMetrics: unknown): number | null {
  const keys = [
    'globalFeesPaidSol',
    'global_fees_paid_sol',
    'feesPaidSol',
    'total_fee_sol',
    'globalFeesSol',
  ];
  const walk = (obj: unknown, depth: number): number | null => {
    if (depth > 12 || obj == null) return null;
    if (typeof obj === 'object' && !Array.isArray(obj)) {
      const r = obj as Record<string, unknown>;
      for (const k of keys) {
        const n = asNum(r[k]);
        if (n != null && n >= 0) return n;
      }
      for (const v of Object.values(r)) {
        const h = walk(v, depth + 1);
        if (h != null) return h;
      }
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const h = walk(item, depth + 1);
        if (h != null) return h;
      }
    }
    return null;
  };
  return walk(extendedMetrics, 0);
}
