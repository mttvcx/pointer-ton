'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminCan, useAdminFetch, useAdminMe } from '@/lib/admin/useAdminApi';
import { cn } from '@/lib/utils/cn';

type PlanRow = { actionId: string; label: string; mode: 'execute' | 'recommend' | 'escalate' | 'skip'; reason: string; danger: string };
type Resp = { enabled: boolean; plan: PlanRow[] };

const MODE_TONE: Record<PlanRow['mode'], string> = {
  execute: 'border-signal-bull/40 bg-signal-bull/10 text-signal-bull',
  escalate: 'border-signal-bear/40 bg-signal-bear/10 text-signal-bear',
  recommend: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400',
  skip: 'border-border-subtle text-fg-muted',
};

export default function AdminSelfHealPage() {
  const adminFetch = useAdminFetch();
  const qc = useQueryClient();
  const { data: me } = useAdminMe();
  const canRun = adminCan(me, 'emergency.control');
  const [msg, setMsg] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['admin-selfheal'],
    queryFn: async (): Promise<Resp> => {
      const r = await adminFetch('/api/admin/selfheal');
      if (!r.ok) throw new Error(`selfheal_${r.status}`);
      return (await r.json()) as Resp;
    },
    refetchInterval: 30_000,
  });

  const run = useMutation({
    mutationFn: async (actionId: string) => {
      const r = await adminFetch('/api/admin/selfheal', { method: 'POST', body: JSON.stringify({ actionId }) });
      const j = (await r.json().catch(() => ({}))) as { result?: string; error?: string };
      if (!r.ok) throw new Error(j.error || `run_${r.status}`);
      return j.result ?? 'done';
    },
    onError: (e) => setMsg(e instanceof Error ? e.message : 'failed'),
    onSuccess: (result) => {
      setMsg(`✓ ${result}`);
      void qc.invalidateQueries({ queryKey: ['admin-selfheal'] });
    },
  });

  const enabled = q.data?.enabled;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-lg font-semibold text-fg-primary">Self-healing</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Safe, reversible repair actions ranked from Pointer Doctor. Mode is{' '}
          {enabled ? (
            <span className="font-semibold text-signal-bull">ENABLED</span>
          ) : (
            <span className="font-semibold text-yellow-400">OBSERVE-ONLY</span>
          )}{' '}
          — dangerous actions (provider cutoff, anything touching funds/keys/schema/deploys) always{' '}
          <span className="text-signal-bear">escalate</span> for human approval. Set <code>SELFHEAL_ENABLED=1</code> to
          let confident safe actions auto-run.
        </p>
      </header>

      {msg ? <p className="text-[13px] text-fg-secondary">{msg}</p> : null}

      {q.data ? (
        q.data.plan.length === 0 ? (
          <p className="rounded-md border border-border-subtle bg-bg-raised p-4 text-center text-[13px] text-signal-bull">
            Nothing to heal — no actionable findings. ✓
          </p>
        ) : (
          <div className="space-y-2">
            {q.data.plan.map((p) => (
              <section key={p.actionId} className="flex flex-wrap items-center gap-2 rounded-md border border-border-subtle bg-bg-raised px-3 py-2.5">
                <span className={cn('shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', MODE_TONE[p.mode])}>
                  {p.mode}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-fg-primary">{p.label}</p>
                  <p className="text-[11px] text-fg-muted">{p.reason}</p>
                </div>
                {canRun && p.danger === 'safe' ? (
                  <button
                    type="button"
                    disabled={run.isPending}
                    onClick={() => run.mutate(p.actionId)}
                    className="btn-press ml-auto rounded-md border border-accent-primary/40 px-2.5 py-1 text-[11px] font-semibold text-accent-primary transition hover:bg-accent-primary/10 disabled:opacity-50"
                  >
                    Run now
                  </button>
                ) : p.danger === 'dangerous' ? (
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-signal-bear">manual only</span>
                ) : null}
              </section>
            ))}
          </div>
        )
      ) : (
        <p className="text-sm text-fg-muted">Loading plan…</p>
      )}
    </div>
  );
}
