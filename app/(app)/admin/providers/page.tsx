'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminCan, useAdminFetch, useAdminMe } from '@/lib/admin/useAdminApi';

type BreakerState = 'ok' | 'warn' | 'tripped' | 'disabled';
type ProviderStatus = {
  provider: string;
  state: BreakerState;
  disabled: boolean;
  usedDaily: number;
  usedMonthly: number;
  budget: { daily: number; monthly: number; warnPct: number };
};

const num = (n: number) => (n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

const STATE_TONE: Record<BreakerState, string> = {
  ok: 'text-signal-bull',
  warn: 'text-yellow-400',
  tripped: 'text-signal-bear',
  disabled: 'text-fg-muted',
};

function Bar({ used, cap, warnPct }: { used: number; cap: number; warnPct: number }) {
  if (cap <= 0) return <p className="text-[10px] text-fg-muted">no cap</p>;
  const pct = Math.min(100, (used / cap) * 100);
  const tone = pct > 100 ? 'bg-signal-bear' : pct >= warnPct ? 'bg-yellow-400' : 'bg-signal-bull';
  return (
    <div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-sunken">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-0.5 text-right text-[10px] tabular-nums text-fg-muted">
        {num(used)} / {num(cap)} ({pct.toFixed(0)}%)
      </p>
    </div>
  );
}

function ProviderCard({
  p,
  canControl,
  onToggle,
  busy,
}: {
  p: ProviderStatus;
  canControl: boolean;
  onToggle: (provider: string, disabled: boolean) => void;
  busy: boolean;
}) {
  return (
    <section className="rounded-md border border-border-subtle bg-bg-raised p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[13px] font-semibold text-fg-primary">{p.provider}</span>
        <span className={`text-[11px] font-semibold uppercase tracking-wide ${STATE_TONE[p.state]}`}>{p.state}</span>
      </div>
      <div className="mt-3 space-y-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-fg-muted">Daily</p>
          <Bar used={p.usedDaily} cap={p.budget.daily} warnPct={p.budget.warnPct} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-fg-muted">Monthly</p>
          <Bar used={p.usedMonthly} cap={p.budget.monthly} warnPct={p.budget.warnPct} />
        </div>
      </div>
      {canControl ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggle(p.provider, !p.disabled)}
          className={`mt-3 w-full rounded-md border px-2 py-1.5 text-[12px] font-semibold transition disabled:opacity-50 ${
            p.disabled
              ? 'border-signal-bull/40 text-signal-bull hover:bg-signal-bull/10'
              : 'border-signal-bear/40 text-signal-bear hover:bg-signal-bear/10'
          }`}
        >
          {p.disabled ? 'Restore calls' : 'Emergency cutoff'}
        </button>
      ) : null}
    </section>
  );
}

export default function AdminProvidersPage() {
  const adminFetch = useAdminFetch();
  const qc = useQueryClient();
  const { data: me } = useAdminMe();
  const canControl = adminCan(me, 'providers.control');
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['admin-providers'],
    queryFn: async (): Promise<ProviderStatus[]> => {
      const r = await adminFetch('/api/admin/providers');
      if (!r.ok) throw new Error(`providers_${r.status}`);
      return ((await r.json()) as { providers: ProviderStatus[] }).providers;
    },
    refetchInterval: 15_000,
  });

  const toggle = useMutation({
    mutationFn: async (vars: { provider: string; disabled: boolean }) => {
      const reason = vars.disabled
        ? window.prompt(`Reason for cutting off ${vars.provider}?`) ?? undefined
        : undefined;
      const r = await adminFetch('/api/admin/providers', {
        method: 'POST',
        body: JSON.stringify({ ...vars, reason }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { message?: string };
        throw new Error(j.message || `cutoff_${r.status}`);
      }
    },
    onError: (e) => setErr(e instanceof Error ? e.message : 'failed'),
    onSuccess: () => {
      setErr(null);
      void qc.invalidateQueries({ queryKey: ['admin-providers'] });
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-lg font-semibold text-fg-primary">Provider circuit breakers</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Upstream cost protection. Each call is charged against atomic daily + monthly counters; the breaker{' '}
          <span className="text-yellow-400">warns</span> near budget and <span className="text-signal-bear">trips</span>{' '}
          (hard cutoff) over it. Data providers fail open on a Redis blip; the trade path (Jupiter) records usage but only
          a manual cutoff blocks it. Budgets are env-configurable.
        </p>
      </header>

      {err ? <p className="text-[13px] text-signal-bear">{err}</p> : null}

      {q.data ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.map((p) => (
            <ProviderCard
              key={p.provider}
              p={p}
              canControl={canControl}
              busy={toggle.isPending}
              onToggle={(provider, disabled) => toggle.mutate({ provider, disabled })}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-fg-muted">Loading providers…</p>
      )}
    </div>
  );
}
