import { SOL_MINT, USDC_MINT, USD1_MINT } from '@/lib/utils/addresses';

/** Mainnet USDT (SPL). */
export const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

const FUNDING_MINTS = new Set<string>([SOL_MINT, USDC_MINT, USD1_MINT, USDT_MINT]);

const FUNDING_SYMBOLS = new Set([
  'SOL',
  'WSOL',
  'USDC',
  'USDT',
  'USD1',
  'PYUSD',
  'EURC',
  'USD',
  'DAI',
  'USDS',
  'CASH',
]);

/**
 * Native / quote / stable balances — not "token" positions in portfolio or analytics desks.
 */
export function isPortfolioFundingAsset(
  mint: string,
  symbol: string | null | undefined,
): boolean {
  const m = mint.trim();
  if (FUNDING_MINTS.has(m)) return true;
  const u = symbol?.trim().toUpperCase() ?? '';
  if (!u) return false;
  if (FUNDING_SYMBOLS.has(u)) return true;
  if (u.startsWith('W') && FUNDING_SYMBOLS.has(u.slice(1))) return true;
  return false;
}

export function filterTradeTokenPositions<T extends { mint: string; symbol?: string | null }>(
  rows: T[],
): T[] {
  return rows.filter((r) => !isPortfolioFundingAsset(r.mint, r.symbol ?? null));
}
