import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import { rollupSamples, type MetricRollup } from '@/lib/ops/metricsRollup';

/**
 * Reads `ops_metrics` time-series and rolls each tracked metric up over a window
 * for the /admin/metrics dashboard. Best-effort: returns an `error` string rather
 * than throwing so the page degrades gracefully.
 */

export type MetricKind = 'timing' | 'counter' | 'gauge';
export type MetricCard = { metric: string; label: string; unit: string; kind: MetricKind; rollup: MetricRollup };

const WINDOW_HOURS = 24;

const TRACKED: { metric: string; label: string; unit: string; kind: MetricKind }[] = [
  { metric: 'webhook.process.ms', label: 'Webhook processing', unit: 'ms', kind: 'timing' },
  { metric: 'cron.duration_ms', label: 'Cron duration', unit: 'ms', kind: 'timing' },
  { metric: 'webhook.received', label: 'Webhooks received', unit: '', kind: 'counter' },
  { metric: 'webhook.deduped', label: 'Webhooks deduped', unit: '', kind: 'counter' },
  { metric: 'webhook.retry.depth', label: 'Webhook retry backlog', unit: '', kind: 'gauge' },
  { metric: 'webhook.dlq.depth', label: 'Webhook dead-letter depth', unit: '', kind: 'gauge' },
];

export async function getMetricCards(): Promise<{ windowHours: number; cards: MetricCard[]; error?: string }> {
  try {
    const supabase = createAdminSupabase();
    const cutoff = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from('ops_metrics')
      .select('metric, value, ts')
      .gte('ts', cutoff)
      .in(
        'metric',
        TRACKED.map((t) => t.metric),
      )
      .order('ts', { ascending: true })
      .limit(20000);
    if (error) throw new Error(error.message);

    const byMetric = new Map<string, number[]>();
    for (const row of (data ?? []) as { metric: string; value: number }[]) {
      const arr = byMetric.get(row.metric) ?? [];
      arr.push(Number(row.value));
      byMetric.set(row.metric, arr);
    }

    const cards: MetricCard[] = TRACKED.map((t) => ({
      ...t,
      rollup: rollupSamples(byMetric.get(t.metric) ?? []),
    }));
    return { windowHours: WINDOW_HOURS, cards };
  } catch (err) {
    return {
      windowHours: WINDOW_HOURS,
      cards: TRACKED.map((t) => ({ ...t, rollup: rollupSamples([]) })),
      error: err instanceof Error ? err.message : 'metrics_failed',
    };
  }
}
