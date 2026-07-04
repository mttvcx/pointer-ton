/**
 * Metric rollups — pure stats over `ops_metrics` samples (no I/O, unit-testable).
 * The I/O (querying ops_metrics over a window) lives in `lib/db/opsMetrics.ts`.
 */

export type MetricRollup = {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  /** Most recent sample value (useful for gauges like queue depth). */
  latest: number | null;
};

/** Linear-interpolated percentile over a numeric series. `p` in [0,1]. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0]!;
  const idx = Math.min(sorted.length - 1, Math.max(0, p * (sorted.length - 1)));
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const frac = idx - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

/** Roll a series of samples up into a summary. `latest` is the value of the most
 *  recently-recorded sample (caller passes samples in chronological order). */
export function rollupSamples(values: number[]): MetricRollup {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) {
    return { count: 0, sum: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, latest: null };
  }
  const sum = finite.reduce((a, b) => a + b, 0);
  return {
    count: finite.length,
    sum,
    avg: sum / finite.length,
    min: Math.min(...finite),
    max: Math.max(...finite),
    p50: percentile(finite, 0.5),
    p95: percentile(finite, 0.95),
    latest: values[values.length - 1] ?? null,
  };
}

/** Success rate (0–100) from ok/total counts; 100 when nothing happened. */
export function successRate(ok: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round((ok / total) * 1000) / 10;
}
