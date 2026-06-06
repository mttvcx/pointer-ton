'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminFetch, useAdminMe, adminCan } from '@/lib/admin/useAdminApi';

type Report = {
  id: string;
  receipt_id: string;
  category: string;
  severity: string;
  description: string;
  route: string | null;
  status: string;
  delivered: boolean;
  created_at: string;
};

const STATUSES = ['new', 'triaged', 'resolved', 'spam'] as const;

export default function AdminBugReportsPage() {
  const adminFetch = useAdminFetch();
  const qc = useQueryClient();
  const me = useAdminMe().data;
  const [filter, setFilter] = useState('');

  const reportsQ = useQuery({
    queryKey: ['admin-bug-reports', filter],
    queryFn: async (): Promise<Report[]> => {
      const res = await adminFetch(`/api/admin/bug-reports${filter ? `?status=${filter}` : ''}`);
      if (!res.ok) throw new Error(`reports_${res.status}`);
      return (await res.json()).reports as Report[];
    },
  });

  const canWrite = adminCan(me, 'bugreports.write');

  async function setStatus(id: string, status: string) {
    const res = await adminFetch(`/api/admin/bug-reports/${id}`, { method: 'POST', body: JSON.stringify({ status }) });
    if (res.ok) void qc.invalidateQueries({ queryKey: ['admin-bug-reports'] });
  }

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold text-fg-primary">Bug reports</h1>
          <p className="mt-1 text-sm text-fg-muted">Incoming diagnostics, persisted for triage.</p>
        </div>
        <select className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </header>

      <div className="space-y-3">
        {reportsQ.isLoading ? (
          <p className="text-sm text-fg-muted">Loading…</p>
        ) : reportsQ.data && reportsQ.data.length > 0 ? (
          reportsQ.data.map((r) => (
            <article key={r.id} className="rounded-md border border-border-subtle bg-bg-raised p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="rounded bg-bg-base px-1.5 py-0.5 font-semibold text-fg-secondary">{r.severity}</span>
                  <span className="text-fg-muted">{r.category}</span>
                  <span className="text-fg-muted">·</span>
                  <span className="font-mono text-fg-muted">{r.route ?? '—'}</span>
                  <span className="text-fg-muted">·</span>
                  <span className="text-fg-muted">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <span className={`rounded px-1.5 py-0.5 text-[11px] ${r.status === 'new' ? 'bg-signal-info/15 text-signal-info' : 'bg-bg-base text-fg-muted'}`}>{r.status}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[13px] text-fg-primary">{r.description.slice(0, 1000)}</p>
              {canWrite ? (
                <div className="mt-2 flex gap-2">
                  {STATUSES.filter((s) => s !== r.status).map((s) => (
                    <button key={s} type="button" onClick={() => void setStatus(r.id, s)} className="rounded-md border border-border-subtle px-2 py-0.5 text-[11px] text-fg-secondary hover:text-fg-primary">
                      mark {s}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <p className="text-sm text-fg-muted">No reports.</p>
        )}
      </div>
    </div>
  );
}
