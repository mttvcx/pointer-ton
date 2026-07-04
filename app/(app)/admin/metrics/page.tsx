'use client';

import { useQuery } from '@tanstack/react-query';
import { useAdminFetch } from '@/lib/admin/useAdminApi';

type Rollup = {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  latest: number | null;
};
type Card = { metric: string; label: string; unit: string; kind: 'timing' | 'counter' | 'gauge'; rollup: Rollup };
type Resp = { windowHours: number; cards: Card[]; error?: string };

const fmt = (n: number, unit: string) => {
  const v = Math.abs(n) >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : n.toFixed(n % 1 === 0 ? 0 : 1);
  return unit ? `${v} ${unit}` : v;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] font-semibold uppercase tracking-wide text-fg-muted">{label}</span>
      <span className="text-[13px] font-semibold tabular-nums text-fg-primary">{value}</span>
    </div>
  );
}

function MetricCardView({ c }: { c: Card }) {
  const r = c.rollup;
  return (
    <section className="rounded-md border border-border-subtle bg-bg-raised p-3.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-fg-primary">{c.label}</span>
        <span className="font-mono text-[10px] text-fg-muted">{c.metric}</span>
      </div>
      {c.kind === 'gauge' ? (
        <div className="mt-3 flex items-end gap-4">
          <Stat label="Current" value={fmt(r.latest ?? 0, c.unit)} />
          <Stat label="Peak (24h)" value={fmt(r.max, c.unit)} />
          <Stat label="Samples" value={String(r.count)} />
        </div>
      ) : c.kind === 'counter' ? (
        <div className="mt-3 flex items-end gap-4">
          <Stat label="Total (24h)" value={fmt(r.sum, c.unit)} />
          <Stat label="Samples" value={String(r.count)} />
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
          <Stat label="p50" value={fmt(r.p50, c.unit)} />
          <Stat label="p95" value={fmt(r.p95, c.unit)} />
          <Stat label="avg" value={fmt(r.avg, c.unit)} />
          <Stat label="max" value={fmt(r.max, c.unit)} />
          <Stat label="count" value={String(r.count)} />
        </div>
      )}
    </section>
  );
}

export default function AdminMetricsPage() {
  const adminFetch = useAdminFetch();
  const q = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: async (): Promise<Resp> => {
      const r = await adminFetch('/api/admin/metrics');
      if (!r.ok) throw new Error(`metrics_${r.status}`);
      return (await r.json()) as Resp;
    },
    refetchInterval: 20_000,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-lg font-semibold text-fg-primary">Metrics</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Per-subsystem rollups over the last {q.data?.windowHours ?? 24}h from <code>ops_metrics</code> — webhook
          latency/throughput, retry &amp; dead-letter depth, cron duration. (Trading/indexer/provider health lives on{' '}
          <a className="text-accent-primary hover:underline" href="/admin/ops">System health</a>.)
        </p>
      </header>

      {q.data?.error ? <p className="text-[13px] text-signal-bear">Metrics store error: {q.data.error}</p> : null}

      {q.data ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {q.data.cards.map((c) => (
            <MetricCardView key={c.metric} c={c} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-fg-muted">Loading metrics…</p>
      )}
    </div>
  );
}
