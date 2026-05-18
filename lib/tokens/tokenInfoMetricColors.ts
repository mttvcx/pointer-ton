import { cn } from '@/lib/utils/cn';

/** Subtle cell tint from the value text tier (bull/warn/bear). */
export function tokenMetricCellSurface(valueTextClass: string): string {
  if (valueTextClass.includes('text-signal-bull')) return 'bg-signal-bull/10';
  if (valueTextClass.includes('text-signal-bear')) return 'bg-signal-bear/10';
  if (valueTextClass.includes('text-signal-warn')) return 'bg-signal-warn/10';
  return 'bg-bg-raised';
}

/**
 * Axiom-style read: low risky concentration → green, elevated → amber, high → red.
 * LP burned: full burn → green.
 * Dex paid: boolean.
 */
export function tokenMetricValueClass(
  kind:
    | 'top10'
    | 'devh'
    | 'sniper'
    | 'insider'
    | 'bundler'
    | 'lp'
    | 'holders'
    | 'pro'
    | 'dex',
  n: number | null | undefined,
  dexPaid?: boolean | null,
): string {
  if (kind === 'dex') {
    if (dexPaid === true) return 'text-sm font-semibold tabular-nums text-signal-bull';
    return 'text-sm font-semibold tabular-nums text-signal-bear';
  }

  const v = n ?? 0;
  const isZero = !Number.isFinite(v) || v === 0;

  if (kind === 'holders' || kind === 'pro') {
    return cn('text-sm font-semibold tabular-nums', isZero ? 'text-fg-muted' : 'text-fg-primary');
  }

  if (kind === 'lp') {
    if (!Number.isFinite(v)) return 'text-sm font-semibold tabular-nums text-fg-muted';
    if (v >= 99) return 'text-sm font-semibold tabular-nums text-signal-bull';
    if (v >= 70) return 'text-sm font-semibold tabular-nums text-signal-warn';
    return 'text-sm font-semibold tabular-nums text-signal-bear';
  }

  if (kind === 'top10' || kind === 'devh') {
    if (isZero) return 'text-sm font-semibold tabular-nums text-fg-muted';
    if (v < 5) return 'text-sm font-semibold tabular-nums text-signal-bull';
    if (v < 18) return 'text-sm font-semibold tabular-nums text-signal-warn';
    return 'text-sm font-semibold tabular-nums text-signal-bear';
  }

  if (kind === 'sniper' || kind === 'insider' || kind === 'bundler') {
    if (isZero) return 'text-sm font-semibold tabular-nums text-signal-bull';
    if (v < 2.5) return 'text-sm font-semibold tabular-nums text-signal-warn';
    return 'text-sm font-semibold tabular-nums text-signal-bear';
  }

  return 'text-sm font-semibold tabular-nums text-fg-primary';
}
