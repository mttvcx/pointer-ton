import { cn } from '@/lib/utils/cn';
import { metricMissingClass } from '@/lib/tokens/tokenDeskRisk';

/** Subtle cell tint from the value text tier (bull/warn/bear) on grey workspace surfaces. */
export function tokenMetricCellSurface(valueTextClass: string): string {
  if (valueTextClass.includes('text-signal-bull')) return 'bg-signal-bull/[0.08]';
  if (valueTextClass.includes('text-signal-bear')) return 'bg-signal-bear/[0.08]';
  if (valueTextClass.includes('text-signal-warn')) return 'bg-signal-warn/[0.08]';
  return 'bg-bg-hover/70';
}

function isMissing(n: number | null | undefined): boolean {
  return n == null || !Number.isFinite(n);
}

/**
 * Axiom-style read: low risky concentration → green, elevated → amber, high → red.
 * Missing values → muted gray (never green).
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
    if (dexPaid === false) return 'text-sm font-semibold tabular-nums text-signal-bear';
    return metricMissingClass();
  }

  if (isMissing(n)) {
    return metricMissingClass();
  }

  const v = n as number;

  if (kind === 'holders' || kind === 'pro') {
    return cn(
      'text-sm font-semibold tabular-nums',
      v === 0 ? 'text-fg-muted' : 'text-fg-primary',
    );
  }

  if (kind === 'lp') {
    if (v >= 99) return 'text-sm font-semibold tabular-nums text-signal-bull';
    if (v >= 70) return 'text-sm font-semibold tabular-nums text-signal-warn';
    return 'text-sm font-semibold tabular-nums text-signal-bear';
  }

  if (kind === 'top10' || kind === 'devh') {
    if (v === 0) return 'text-sm font-semibold tabular-nums text-signal-bull';
    if (v < 5) return 'text-sm font-semibold tabular-nums text-signal-bull';
    if (v < 18) return 'text-sm font-semibold tabular-nums text-signal-warn';
    return 'text-sm font-semibold tabular-nums text-signal-bear';
  }

  if (kind === 'sniper' || kind === 'insider' || kind === 'bundler') {
    if (v === 0) return 'text-sm font-semibold tabular-nums text-signal-bull';
    if (v < 2.5) return 'text-sm font-semibold tabular-nums text-signal-warn';
    return 'text-sm font-semibold tabular-nums text-signal-bear';
  }

  return 'text-sm font-semibold tabular-nums text-fg-primary';
}
