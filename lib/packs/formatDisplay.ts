export function formatPackMc(usd: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd)) return '—';
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(1)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(2)}`;
}

export function formatPackTokenAmount(amount: number | null | undefined, _symbol?: string): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 10_000) return Math.round(amount).toLocaleString();
  if (amount >= 100) return Math.round(amount).toLocaleString();
  if (amount >= 1) return amount.toFixed(1);
  return amount.toFixed(2);
}

export function formatPackVal(usd: number | null | undefined, sol: number | null | undefined): string {
  if (usd != null && Number.isFinite(usd)) return `$${usd.toFixed(2)}`;
  if (sol != null && Number.isFinite(sol)) return `${sol.toFixed(3)} SOL`;
  return '—';
}
