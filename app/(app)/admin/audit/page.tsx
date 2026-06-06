'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAdminFetch } from '@/lib/admin/useAdminApi';

type Entry = {
  id: string;
  actor_label: string;
  action: string;
  target_type: string;
  target_id: string | null;
  reason: string | null;
  created_at: string;
};

export default function AdminAuditPage() {
  const adminFetch = useAdminFetch();
  const [actionFilter, setActionFilter] = useState('');

  const auditQ = useQuery({
    queryKey: ['admin-audit', actionFilter],
    queryFn: async (): Promise<Entry[]> => {
      const res = await adminFetch(`/api/admin/audit${actionFilter ? `?action=${encodeURIComponent(actionFilter)}` : ''}`);
      if (!res.ok) throw new Error(`audit_${res.status}`);
      return (await res.json()).entries as Entry[];
    },
  });

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-fg-primary">Audit log</h1>
          <p className="mt-1 text-sm text-fg-muted">Every admin action, attributed and timestamped.</p>
        </div>
        <input
          className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]"
          placeholder="Filter by action (exact)"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        />
      </header>

      <section className="rounded-md border border-border-subtle bg-bg-raised">
        <div className="max-h-[70vh] overflow-auto">
          {auditQ.data && auditQ.data.length > 0 ? (
            <table className="w-full text-[12px]">
              <thead className="text-fg-muted">
                <tr className="text-left">
                  <th className="px-3 py-1.5">When</th>
                  <th className="px-3 py-1.5">Actor</th>
                  <th className="px-3 py-1.5">Action</th>
                  <th className="px-3 py-1.5">Target</th>
                  <th className="px-3 py-1.5">Reason</th>
                </tr>
              </thead>
              <tbody>
                {auditQ.data.map((e) => (
                  <tr key={e.id} className="border-t border-border-subtle/40 text-fg-secondary">
                    <td className="px-3 py-1.5 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                    <td className="px-3 py-1.5">{e.actor_label}</td>
                    <td className="px-3 py-1.5 font-mono">{e.action}</td>
                    <td className="px-3 py-1.5 font-mono">{e.target_type}{e.target_id ? `:${e.target_id.slice(0, 8)}…` : ''}</td>
                    <td className="px-3 py-1.5 max-w-[240px] truncate">{e.reason ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-3 text-sm text-fg-muted">No audit entries.</p>
          )}
        </div>
      </section>
    </div>
  );
}
