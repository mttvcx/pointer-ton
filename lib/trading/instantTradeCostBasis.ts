/**
 * Tracks cumulative TON (SOL) spent on buys from the instant panel per mint + wallet.
 * Used for "Sell Init." — recover principal via `amountSolOut` sell quotes.
 */

const STORAGE_PREFIX = 'pointer-instant-cost-ton-v1';

function storageKey(mint: string, wallet: string): string {
  return `${STORAGE_PREFIX}:${mint}:${wallet}`;
}

export function readInstantTradeCostBasisTon(mint: string, wallet: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(storageKey(mint, wallet));
    if (!raw) return 0;
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function addInstantTradeCostBasisTon(mint: string, wallet: string, tonSol: number): void {
  if (!Number.isFinite(tonSol) || tonSol <= 0) return;
  if (typeof window === 'undefined') return;
  try {
    const cur = readInstantTradeCostBasisTon(mint, wallet);
    localStorage.setItem(storageKey(mint, wallet), String(cur + tonSol));
  } catch {
    /* ignore quota */
  }
}

export function clearInstantTradeCostBasisTon(mint: string, wallet: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(storageKey(mint, wallet));
  } catch {
    /* ignore */
  }
}
