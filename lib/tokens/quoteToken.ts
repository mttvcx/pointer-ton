import type { AppChainId } from '@/lib/chains/appChain';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { SOL_MINT, USDC_MINT, USD1_MINT } from '@/lib/utils/addresses';
import type { PulseTokenBundle } from '@/types/tokens';

export { USD1_MINT };

export type QuoteTokenKind = 'native' | 'usdc' | 'usd1';

const QUOTE_MINT_TO_KIND: Record<string, QuoteTokenKind> = {
  [SOL_MINT]: 'native',
  [USDC_MINT]: 'usdc',
  [USD1_MINT]: 'usd1',
};

function walkStringField(obj: unknown, keys: string[], depth = 0): string | null {
  if (depth > 8 || obj == null) return null;
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    const r = obj as Record<string, unknown>;
    for (const key of keys) {
      const v = r[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    for (const v of Object.values(r)) {
      const found = walkStringField(v, keys, depth + 1);
      if (found) return found;
    }
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = walkStringField(item, keys, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function symbolToQuoteKind(sym: string, chain: AppChainId): QuoteTokenKind | null {
  const upper = sym.trim().toUpperCase();
  if (!upper) return null;
  if (upper.includes('USD1')) return 'usd1';
  if (upper.includes('USDC') || upper === 'USD' || upper === 'USDT') return 'usdc';

  const nt = nativeTicker(chain).toUpperCase();
  if (nt === 'SOL') {
    if (upper.includes('SOL') || upper === 'WSOL') return 'native';
  } else if (nt === 'TON') {
    if (upper.includes('TON')) return 'native';
  } else if (nt === 'BNB') {
    if (upper.includes('BNB') || upper.includes('WBNB')) return 'native';
  } else if (nt === 'ETH') {
    if (upper.includes('ETH') || upper.includes('WETH')) return 'native';
  } else if (upper.includes(nt)) {
    return 'native';
  }
  return null;
}

function mintToQuoteKind(mint: string | null | undefined): QuoteTokenKind | null {
  if (!mint?.trim()) return null;
  return QUOTE_MINT_TO_KIND[mint.trim()] ?? null;
}

function parsePoolPairName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  const parts = name.split('/').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return parts[parts.length - 1] ?? null;
}

/** Resolve pair quote symbol from snapshot extended_metrics or token raw metadata. */
export function quoteSymbolFromBundle(
  bundle: PulseTokenBundle,
  chain: AppChainId = 'sol',
): string | null {
  const roots = [bundle.snapshot?.extended_metrics, bundle.token.raw_metadata].filter(Boolean);
  for (const root of roots) {
    const sym = walkStringField(root, ['quoteSymbol', 'quote', 'pairQuote', 'geckoQuoteSymbol']);
    if (sym) return sym.toUpperCase();
  }

  const raw = bundle.token.raw_metadata;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    const quoteMint =
      (typeof r.quoteMint === 'string' ? r.quoteMint : null) ??
      walkStringField(r.geckoPool, ['quoteMint']);
    const fromMint = mintToQuoteKind(quoteMint);
    if (fromMint === 'usd1') return 'USD1';
    if (fromMint === 'usdc') return 'USDC';
    if (fromMint === 'native') return nativeTicker(chain);

    const poolName =
      typeof r.geckoPool === 'object' &&
      r.geckoPool &&
      !Array.isArray(r.geckoPool) &&
      typeof (r.geckoPool as { attributes?: { name?: unknown } }).attributes?.name === 'string'
        ? ((r.geckoPool as { attributes: { name: string } }).attributes.name as string)
        : (walkStringField(raw, ['poolName', 'pairName']) ?? null);
    const quoteLeg = parsePoolPairName(poolName);
    if (quoteLeg) return quoteLeg.toUpperCase();
  }

  return null;
}

export function resolveQuoteTokenKind(
  bundle: PulseTokenBundle,
  chain: AppChainId = 'sol',
): QuoteTokenKind | null {
  const raw = bundle.token.raw_metadata;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    const quoteMint =
      (typeof r.quoteMint === 'string' ? r.quoteMint : null) ??
      (typeof r.quote_mint === 'string' ? r.quote_mint : null);
    const fromMint = mintToQuoteKind(quoteMint);
    if (fromMint) return fromMint;
  }

  const ext = bundle.snapshot?.extended_metrics;
  if (ext && typeof ext === 'object' && !Array.isArray(ext)) {
    const quoteMint = walkStringField(ext, ['quoteMint', 'quote_mint']);
    const fromMint = mintToQuoteKind(quoteMint);
    if (fromMint) return fromMint;
  }

  const sym = quoteSymbolFromBundle(bundle, chain);
  if (sym) return symbolToQuoteKind(sym, chain);
  return null;
}

export function quoteTokenLabel(kind: QuoteTokenKind, chain: AppChainId = 'sol'): string {
  if (kind === 'native') return nativeTicker(chain);
  if (kind === 'usdc') return 'USDC';
  return 'USD1';
}

export function quotePairTooltip(kind: QuoteTokenKind, chain: AppChainId = 'sol'): string {
  return quotePairHoverLabel(kind, chain);
}

/** Short hover label for quote pair chips (Axiom: "USDC pair"). */
export function quotePairHoverLabel(kind: QuoteTokenKind, chain: AppChainId = 'sol'): string {
  const label = quoteTokenLabel(kind, chain);
  return `${label} pair`;
}

/** Non-native pair quotes shown beside the row age chip (USDC / USD1 — not default SOL). */
export function alternateQuotePairKind(
  bundle: PulseTokenBundle,
  chain: AppChainId = 'sol',
): 'usdc' | 'usd1' | null {
  const kind = resolveQuoteTokenKind(bundle, chain);
  if (kind === 'usdc' || kind === 'usd1') return kind;
  return null;
}
