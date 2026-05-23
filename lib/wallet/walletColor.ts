const WALLET_COLORS = [
  '#3DDC97',
  '#5EBBFF',
  '#FFB547',
  '#FF5E78',
  '#9B6CFF',
  '#10D078',
  '#FF6B35',
] as const;

/** Deterministic accent color for a wallet address — stable across the app. */
export function walletColor(addr: string): string {
  let hash = 0;
  for (const c of addr) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return WALLET_COLORS[Math.abs(hash) % WALLET_COLORS.length]!;
}
