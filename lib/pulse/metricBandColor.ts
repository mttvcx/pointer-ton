import type { MetricBand } from '@/lib/preferences/pulseDisplay';
import { formatCompactUsd } from '@/lib/utils/formatters';

export type MetricBandTier = 'low' | 'mid' | 'high';

const TIER_INDEX: Record<MetricBandTier, 0 | 1 | 2> = {
  low: 0,
  mid: 1,
  high: 2,
};

/** Resolve which tier a numeric metric value falls into. */
export function resolveMetricBandTier(value: number | null | undefined, band: MetricBand): MetricBandTier {
  if (value == null || !Number.isFinite(value) || value < 0) return 'low';

  if (band.highMode === 'below') {
    if (value > band.mid) return 'low';
    if (value > band.low) return 'mid';
    return 'high';
  }

  if (value <= band.low) return 'low';
  if (value <= band.mid) return 'mid';
  return 'high';
}

export function metricBandColorForValue(
  value: number | null | undefined,
  band: MetricBand,
): string | undefined {
  const tier = resolveMetricBandTier(value, band);
  return band.colors[TIER_INDEX[tier]];
}

function formatBandBoundary(value: number, mode: 'usd' | 'plain' | 'minutes'): string {
  if (mode === 'usd') {
    const compact = formatCompactUsd(value);
    return compact.startsWith('$') ? compact.slice(1) : compact;
  }
  if (mode === 'minutes') return `${value}m`;
  return String(value);
}

/** Caption under each tier column in the Metrics editor. */
export function metricBandTierRangeLabel(
  tier: MetricBandTier,
  band: MetricBand,
  mode: 'usd' | 'plain' | 'minutes' = 'usd',
): string {
  const low = formatBandBoundary(band.low, mode);
  const mid = formatBandBoundary(band.mid, mode);

  if (tier === 'low') {
    if (band.highMode === 'below') return `>${mid}`;
    return `0-${low}`;
  }
  if (tier === 'mid') {
    if (band.highMode === 'below') return `${mid}-${low}`;
    return `${low}-${mid}`;
  }
  if (band.highMode === 'below') return `≤${mid}`;
  return `${mid}+`;
}
