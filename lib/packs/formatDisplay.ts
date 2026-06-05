import { formatCompactUsd } from '@/lib/utils/formatters';

/** Trader-friendly SOL price label (clean tier amounts). */
export function formatPackSolPrice(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  if (amount >= 10) return String(Math.round(amount));
  const rounded = Math.round(amount * 1000) / 1000;
  const s = rounded.toFixed(3).replace(/\.?0+$/, '');
  return s || String(amount);
}

export function formatApproxUsd(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${Math.round(amount)}`;
}

export function formatPackMc(usd: number | null | undefined): string {
  const s = formatCompactUsd(usd);
  return s === '\u2014' ? '—' : s;
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
