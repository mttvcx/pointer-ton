import 'server-only';
import { jupiterRequestHeaders } from '@/lib/jupiter/httpHeaders';
import type {
  SyntheticStockCategory,
  SyntheticStockMarket,
  SyntheticStockMarketType,
} from '@/lib/stocks/types';

/**
 * REAL xStocks (Backed Finance) markets, sourced from Jupiter's token API — the
 * same venue the app already routes swaps through. xStocks are 1:1-backed
 * tokenized equities as SPL (token-2022) mints, so they trade through the existing
 * Solana/Jupiter pipeline; here we only surface the discovery/market data.
 *
 * One Jupiter token-search call returns price, market cap, liquidity, 24h volume,
 * 24h change, holder count and the official Backed logo per token — everything a
 * `SyntheticStockMarket` needs, from one authoritative source. No mock data.
 */

const JUPITER_TOKEN_V2_BASE =
  process.env.JUPITER_TOKEN_API_URL?.replace(/\/$/, '') ?? 'https://lite-api.jup.ag/tokens/v2';

interface JupStats {
  priceChange?: number; // percent, e.g. 0.68 = +0.68%
  buyVolume?: number;
  sellVolume?: number;
}
interface JupToken {
  id: string; // mint
  name?: string;
  symbol?: string;
  icon?: string;
  decimals?: number;
  mcap?: number;
  fdv?: number;
  usdPrice?: number;
  liquidity?: number;
  holderCount?: number;
  stats24h?: JupStats;
  tags?: string[];
  isVerified?: boolean;
}

/** Pre-IPO tickers (no public shares — only available because Backed tokenizes the
 *  private equity). Kept explicit so the Pre-IPO shelf is honest. */
const PRE_IPO_SYMBOLS = new Set(['SPCX', 'OPENAI', 'ANTHROPIC']);
/** Index trackers. */
const INDEX_SYMBOLS = new Set(['SPY', 'QQQ', 'DIA', 'IWM', 'VTI', 'VOO']);
/** Equities whose business is crypto (surface under a crypto-equity label). */
const CRYPTO_EQUITY_SYMBOLS = new Set(['MSTR', 'COIN', 'CRCL', 'HOOD', 'GLXY', 'BMNR']);

/** Strip the xStock "x" suffix → underlying ticker (TSLAx → TSLA). */
function baseTicker(symbol: string): string {
  return symbol.replace(/x$/, '').toUpperCase();
}

function classify(symbol: string): SyntheticStockMarketType {
  const t = baseTicker(symbol);
  if (PRE_IPO_SYMBOLS.has(t)) return 'pre_ipo';
  if (INDEX_SYMBOLS.has(t)) return 'index';
  if (CRYPTO_EQUITY_SYMBOLS.has(t)) return 'crypto_equity';
  return 'public_equity';
}

function shortName(name: string): string {
  // "Tesla xStock" → "Tesla"
  return name.replace(/\s*xStock\s*$/i, '').trim() || name;
}

async function fetchXStockTokens(): Promise<JupToken[]> {
  // Every xStock shares "xStock" in its name, so one search returns the set; a few
  // symbol queries backstop any result cap. Dedupe by mint, keep only the verified
  // `xstocks`-tagged tokens (never trust an unverified look-alike on a money path).
  const queries = ['xStock', 'TSLAx', 'NVDAx', 'AAPLx', 'SPCXx', 'CRCLx', 'SPYx'];
  const byMint = new Map<string, JupToken>();
  for (const q of queries) {
    let arr: unknown;
    try {
      const res = await fetch(`${JUPITER_TOKEN_V2_BASE}/search?query=${encodeURIComponent(q)}`, {
        headers: jupiterRequestHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) continue;
      arr = await res.json();
    } catch {
      continue;
    }
    for (const t of (Array.isArray(arr) ? arr : []) as JupToken[]) {
      if (!t?.id || !t.symbol) continue;
      const tags = t.tags ?? [];
      if (!tags.includes('xstocks') || !t.isVerified) continue;
      if (!byMint.has(t.id)) byMint.set(t.id, t);
    }
  }
  return [...byMint.values()];
}

function toMarket(t: JupToken, category: SyntheticStockCategory): SyntheticStockMarket {
  const vol =
    (typeof t.stats24h?.buyVolume === 'number' ? t.stats24h.buyVolume : 0) +
    (typeof t.stats24h?.sellVolume === 'number' ? t.stats24h.sellVolume : 0);
  return {
    symbol: t.symbol as string,
    name: shortName(t.name ?? (t.symbol as string)),
    category,
    marketType: classify(t.symbol as string),
    priceUsd: typeof t.usdPrice === 'number' ? t.usdPrice : 0,
    change24hPct: typeof t.stats24h?.priceChange === 'number' ? t.stats24h.priceChange : 0,
    volume24hUsd: vol,
    marketCapUsd: typeof t.mcap === 'number' ? t.mcap : (typeof t.fdv === 'number' ? t.fdv : 0),
    openInterestUsd: null, // spot, no perp OI
    fundingRatePct: null, // spot, no funding
    liquidityUsd: typeof t.liquidity === 'number' ? t.liquidity : null,
    aiSummary: `Tokenized ${shortName(t.name ?? '')} — 1:1-backed equity, traded on Solana.`,
    // mint carried so the UI can deep-link to the real /token/[mint] trade page.
    mint: t.id,
    iconUrl: t.icon ?? null,
  };
}

/** Build the categorized, real xStocks board. pre-IPO is explicit; the rest split
 *  into HOT (top 24h volume) and TOP (largest market cap), with overlap allowed. */
export async function fetchXStocksMarkets(): Promise<SyntheticStockMarket[]> {
  const tokens = await fetchXStockTokens();
  if (tokens.length === 0) return [];

  const preIpo: SyntheticStockMarket[] = [];
  const rest: JupToken[] = [];
  for (const t of tokens) {
    if (classify(t.symbol ?? '') === 'pre_ipo') preIpo.push(toMarket(t, 'pre_ipo'));
    else rest.push(t);
  }

  const byVol = [...rest].sort(
    (a, b) =>
      ((b.stats24h?.buyVolume ?? 0) + (b.stats24h?.sellVolume ?? 0)) -
      ((a.stats24h?.buyVolume ?? 0) + (a.stats24h?.sellVolume ?? 0)),
  );
  const byMcap = [...rest].sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0));

  const hot = byVol.slice(0, 14).map((t) => toMarket(t, 'hot'));
  const top = byMcap.slice(0, 14).map((t) => toMarket(t, 'top'));

  return [...preIpo, ...hot, ...top];
}
