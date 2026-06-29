'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminFetch } from '@/lib/admin/useAdminApi';
import { availableActions, type IncidentAction, type IncidentStatus } from '@/lib/ops/incidentLifecycle';
import { cn } from '@/lib/utils/cn';

type Incident = {
  id: string;
  key: string;
  category: string;
  name: string;
  severity: string;
  status: IncidentStatus;
  count: number;
  sample_message: string | null;
  last_seen: string;
  detail: { lifecycle?: { owner?: string | null; timeline?: { at: string; actor: string; kind: string; note?: string; from?: string; to?: string }[] } } | null;
};

const STATUS_TONE: Record<IncidentStatus, string> = {
  open: 'border-signal-bear/40 bg-signal-bear/10 text-signal-bear',
  acknowledged: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400',
  investigating: 'border-orange-500/40 bg-orange-500/10 text-orange-400',
  mitigated: 'border-accent-primary/40 bg-accent-primary/10 text-accent-primary',
  resolved: 'border-signal-bull/40 bg-signal-bull/10 text-signal-bull',
};
const SEV_TONE: Record<string, string> = {
  critical: 'text-signal-bear',
  error: 'text-orange-400',
  warn: 'text-yellow-400',
  info: 'text-fg-muted',
};
const ACTION_LABEL: Record<IncidentAction, string> = {
  acknowledge: 'Acknowledge',
  investigate: 'Investigate',
  mitigate: 'Mitigate',
  resolve: 'Resolve',
  reopen: 'Reopen',
};

function IncidentRow({ inc, onAct }: { inc: Incident; onAct: (id: string, action: IncidentAction) => void }) {
  const lc = inc.detail?.lifecycle;
  const timeline = lc?.timeline ?? [];
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-md border border-border-subtle bg-bg-raised">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <span className={cn('shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', STATUS_TONE[inc.status])}>
          {inc.status}
        </span>
        <span className={cn('text-[11px] font-semibold uppercase', SEV_TONE[inc.severity] ?? 'text-fg-muted')}>{inc.severity}</span>
        <span className="min-w-0 truncate font-mono text-[12px] text-fg-primary">{inc.key}</span>
        <span className="text-[10px] text-fg-muted">×{inc.count}</span>
        {lc?.owner ? <span className="text-[10px] text-fg-secondary">@{lc.owner}</span> : null}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {availableActions(inc.status).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onAct(inc.id, a)}
              className="btn-press rounded-md border border-border-subtle px-2 py-0.5 text-[11px] font-semibold text-fg-secondary transition hover:bg-bg-hover hover:text-fg-primary"
            >
              {ACTION_LABEL[a]}
            </button>
          ))}
          <button type="button" onClick={() => setOpen((v) => !v)} className="px-1 text-[11px] text-fg-muted hover:text-fg-primary">
            {open ? '−' : `timeline (${timeline.length})`}
          </button>
        </div>
      </div>
      {inc.sample_message ? <p className="px-3 pb-2 text-[11px] text-fg-muted">{inc.sample_message}</p> : null}
      {open ? (
        <div className="border-t border-border-subtle/40 px-3 py-2">
          {timeline.length === 0 ? (
            <p className="text-[11px] text-fg-muted">No lifecycle activity yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {timeline.map((t, i) => (
                <li key={i} className="text-[10.5px] text-fg-muted">
                  <span className="tabular-nums text-fg-secondary">{new Date(t.at).toLocaleString()}</span> · {t.actor} ·{' '}
                  {t.kind === 'status' ? `${t.from} → ${t.to}` : t.kind}
                  {t.note ? ` — ${t.note}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}

export default function AdminIncidentsPage() {
  const adminFetch = useAdminFetch();
  const qc = useQueryClient();
  const [activeOnly, setActiveOnly] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['admin-incidents', activeOnly],
    queryFn: async (): Promise<Incident[]> => {
      const r = await adminFetch(`/api/admin/incidents${activeOnly ? '?active=1' : ''}`);
      if (!r.ok) throw new Error(`incidents_${r.status}`);
      return ((await r.json()) as { incidents: Incident[] }).incidents;
    },
    refetchInterval: 20_000,
  });

  const act = useMutation({
    mutationFn: async (vars: { id: string; action: IncidentAction }) => {
      const note = vars.action === 'resolve' ? window.prompt('Resolution note (optional):') ?? undefined : undefined;
      const r = await adminFetch('/api/admin/incidents', {
        method: 'POST',
        body: JSON.stringify({ id: vars.id, action: vars.action, ...(note ? { meta: { note } } : {}) }),
      });
      if (!r.ok) throw new Error((((await r.json().catch(() => ({}))) as { message?: string }).message) || `act_${r.status}`);
    },
    onError: (e) => setErr(e instanceof Error ? e.message : 'failed'),
    onSuccess: () => {
      setErr(null);
      void qc.invalidateQueries({ queryKey: ['admin-incidents'] });
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-fg-primary">Incidents</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Auto-opened on error/critical. Drive each: acknowledge → investigate → mitigate → resolve, with an
            audit-logged timeline.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-1.5 text-[12px] text-fg-secondary">
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
          Active only
        </label>
      </header>

      {err ? <p className="text-[13px] text-signal-bear">{err}</p> : null}

      {q.data ? (
        q.data.length === 0 ? (
          <p className="rounded-md border border-border-subtle bg-bg-raised p-4 text-center text-[13px] text-signal-bull">
            No {activeOnly ? 'active ' : ''}incidents. ✓
          </p>
        ) : (
          <div className="space-y-2">
            {q.data.map((inc) => (
              <IncidentRow key={inc.id} inc={inc} onAct={(id, action) => act.mutate({ id, action })} />
            ))}
          </div>
        )
      ) : (
        <p className="text-sm text-fg-muted">Loading incidents…</p>
      )}
    </div>
  );
}
