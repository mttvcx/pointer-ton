/**
 * Barrel for desk-table format helpers used by token detail tabs.
 * Re-exports existing formatters and adds compact relative/number helpers.
 */

import { formatAgeShort as formatAgeShortBase } from '@/lib/utils/formatters';

export {
  formatAgeShort,
  formatCompactUsd,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatUsd,
} from '@/lib/utils/formatters';

/** Tight relative age: "7s", "2m", "1h", "3d" — no spaces, no "ago". */
export function formatRelativeShort(iso: string): string {
  return formatAgeShortBase(iso);
}

/** Compact numeric without currency: "135K", "66.7K", "9.999". */
export function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n)) return '\u2014';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs < 1) return `${sign}${abs.toFixed(4).replace(/\.?0+$/, '') || '0'}`;
  if (abs < 1000) {
    if (abs >= 10) return `${sign}${Math.round(abs)}`;
    return `${sign}${parseFloat(abs.toFixed(2)).toString()}`;
  }
  const formatted = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(abs);
  return `${sign}${formatted}`;
}
