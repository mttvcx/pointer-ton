/**
 * Public leaderboard identity — NEVER show a real name/username. Show a
 * truncated wallet (start…end), and only that. Falls back to an anonymous
 * handle when no wallet is available.
 */
export function anonLabel(walletAddress?: string | null, userId?: string | null): string {
  const w = walletAddress?.trim();
  if (w && w.length >= 10) return `${w.slice(0, 6)}…${w.slice(-4)}`;
  if (w && w.length > 0) return w; // already short
  const id = (userId ?? '').replace(/[^a-zA-Z0-9]/g, '');
  return id.length >= 4 ? `anon-${id.slice(-4)}` : 'anon';
}
