export type TokenTradePerfTf = '5m' | '1h' | '6h' | '24h';

export const TOKEN_TRADE_PERF_TFS: TokenTradePerfTf[] = ['5m', '1h', '6h', '24h'];

const TF_DEX_KEYS: Record<TokenTradePerfTf, string> = {
  '5m': 'm5',
  '1h': 'h1',
  '6h': 'h6',
  '24h': 'h24',
};

const TF_FLAT_KEYS: Record<TokenTradePerfTf, string[]> = {
  '5m': ['priceChange5mPct', 'price_change_m5', 'chg5mPct'],
  '1h': ['priceChange1hPct', 'price_change_h1', 'chg1hPct'],
  '6h': ['priceChange6hPct', 'price_change_h6', 'chg6hPct'],
  '24h': ['priceChange24hPct', 'price_change_24h_pct', 'chg24hPct', 'change24hPct'],
};

function readNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/%/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Demo-only deterministic % — never rendered in live mode (default off). */
function syntheticPct(mint: string, tf: TokenTradePerfTf): number {
  const seed = hashSeed(`${mint}:perf:${tf}`);
  const base = ((seed % 4000) / 100 - 20) * (tf === '5m' ? 0.35 : tf === '1h' ? 0.65 : tf === '6h' ? 1 : 1.35);
  return Math.round(base * 100) / 100;
}

/**
 * Parse multi-window price change % from snapshot extended_metrics (DexScreener shape).
 * Missing windows are `null` (render as `—`). `allowSynthetic` is demo-mode only
 * and must be explicitly opted into — live token desks never fabricate %.
 */
export function pickTokenTradePerfChanges(
  ext: unknown,
  mint: string,
  opts?: { allowSynthetic?: boolean },
): Record<TokenTradePerfTf, number | null> {
  const allowSynthetic = opts?.allowSynthetic === true;
  const out: Record<TokenTradePerfTf, number | null> = {
    '5m': allowSynthetic ? syntheticPct(mint, '5m') : null,
    '1h': allowSynthetic ? syntheticPct(mint, '1h') : null,
    '6h': allowSynthetic ? syntheticPct(mint, '6h') : null,
    '24h': allowSynthetic ? syntheticPct(mint, '24h') : null,
  };

  if (ext == null || typeof ext !== 'object' || Array.isArray(ext)) return out;
  const root = ext as Record<string, unknown>;

  const nested = root.priceChange ?? root.price_change;
  if (nested != null && typeof nested === 'object' && !Array.isArray(nested)) {
    const pc = nested as Record<string, unknown>;
    for (const tf of TOKEN_TRADE_PERF_TFS) {
      const v = readNum(pc[TF_DEX_KEYS[tf]]);
      if (v != null) out[tf] = v;
    }
  }

  for (const tf of TOKEN_TRADE_PERF_TFS) {
    for (const key of TF_FLAT_KEYS[tf]) {
      const v = readNum(root[key]);
      if (v != null) {
        out[tf] = v;
        break;
      }
    }
  }

  return out;
}

export function formatTradePerfPct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '\u2014';
  const sign = pct >= 0 ? '+' : '';
  const abs = Math.abs(pct);
  const decimals = abs > 0 && abs < 10 ? 2 : 1;
  return `${sign}${pct.toFixed(decimals)}%`;
}
