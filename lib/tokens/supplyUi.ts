/** Token supply in UI units (whole tokens, not base units). */

function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(/[, _]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const SUPPLY_KEYS = [
  'supply',
  'total_supply',
  'totalSupply',
  'max_supply',
  'maxSupply',
  'circulating_supply',
  'circulatingSupply',
  'uiAmount',
  'ui_amount',
] as const;

/** Walk DAS / snapshot JSON for a raw or UI supply figure. */
export function extractRawSupplyValue(metadata: unknown): number | null {
  if (metadata == null) return null;
  const walk = (obj: unknown, depth: number): number | null => {
    if (depth > 12 || obj == null) return null;
    if (typeof obj === 'object' && !Array.isArray(obj)) {
      const r = obj as Record<string, unknown>;
      for (const k of SUPPLY_KEYS) {
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

/**
 * Normalize supply to UI token count.
 * Pump mints store base units in DAS (e.g. 1e15 for 1B @ 6 decimals).
 */
export function normalizeTokenSupplyUi(rawValue: number, decimals: number): number {
  const dec = Math.max(0, Math.min(24, Math.round(decimals)));
  if (rawValue > 1_000_000_000_000) {
    return rawValue / 10 ** dec;
  }
  return rawValue;
}

/** UI supply for desk MC / header — prefers normalized metadata, then snapshot MC/price. */
export function resolveTokenSupplyUi(
  metadata: unknown,
  decimals: number | null | undefined,
  fallback?: { marketCapUsd?: number | null; priceUsd?: number | null },
): number | null {
  const dec = decimals ?? 6;
  const raw = extractRawSupplyValue(metadata);
  if (raw != null && raw > 0) {
    return normalizeTokenSupplyUi(raw, dec);
  }
  const mc = fallback?.marketCapUsd;
  const px = fallback?.priceUsd;
  if (mc != null && px != null && mc > 0 && px > 0) {
    return mc / px;
  }
  return null;
}
