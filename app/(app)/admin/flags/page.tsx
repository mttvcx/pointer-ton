'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminFetch, useAdminMe, adminCan } from '@/lib/admin/useAdminApi';

type Flag = { key: string; value: unknown; description: string | null; allow_prod: boolean; updated_at: string };

export default function AdminFlagsPage() {
  const adminFetch = useAdminFetch();
  const qc = useQueryClient();
  const me = useAdminMe().data;
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ key: '', value: 'true', description: '', allowProd: false, reason: '' });

  const flagsQ = useQuery({
    queryKey: ['admin-flags'],
    queryFn: async (): Promise<Flag[]> => {
      const res = await adminFetch('/api/admin/flags');
      if (!res.ok) throw new Error(`flags_${res.status}`);
      return (await res.json()).flags as Flag[];
    },
  });

  const canWrite = adminCan(me, 'flags.write');

  async function setFlag(key: string, value: boolean | string, allowProd?: boolean, reason?: string) {
    setMsg(null);
    const res = await adminFetch('/api/admin/flags', {
      method: 'POST',
      body: JSON.stringify({ key, value, allowProd, reason }),
    });
    const json = await res.json();
    if (!res.ok) { setMsg(json.error ?? 'set_failed'); return; }
    void qc.invalidateQueries({ queryKey: ['admin-flags'] });
  }

  function parseValue(raw: string): boolean | string {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return raw;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-semibold text-fg-primary">Feature flags</h1>
        <p className="mt-1 text-sm text-fg-muted">Runtime toggles. Flags not marked <code>allow_prod</code> cannot be changed in production.</p>
      </header>
      {msg ? <p className="text-[13px] text-rose-400">{msg}</p> : null}

      {canWrite ? (
        <section className="rounded-md border border-border-subtle bg-bg-raised p-4">
          <h2 className="text-sm font-semibold text-fg-primary">Upsert flag</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" placeholder="key" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
            <input className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" placeholder="value (true/false or string)" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            <input className="sm:col-span-2 rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" placeholder="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <label className="flex items-center gap-2 text-[13px] text-fg-secondary">
              <input type="checkbox" checked={form.allowProd} onChange={(e) => setForm({ ...form, allowProd: e.target.checked })} /> allow in production
            </label>
            <input className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" placeholder="reason (optional)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <button
            type="button"
            onClick={() => void setFlag(form.key.trim(), parseValue(form.value.trim()), form.allowProd, form.reason.trim() || undefined)}
            className="mt-3 rounded-md bg-accent-primary px-3 py-1.5 text-[13px] font-semibold text-fg-inverse"
          >
            Save flag
          </button>
        </section>
      ) : null}

      <section className="rounded-md border border-border-subtle bg-bg-raised">
        <div className="border-b border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Flags</div>
        <div className="max-h-[50vh] overflow-auto">
          {flagsQ.data && flagsQ.data.length > 0 ? (
            <table className="w-full text-[12px]">
              <thead className="text-fg-muted"><tr className="text-left"><th className="px-3 py-1.5">Key</th><th className="px-3 py-1.5">Value</th><th className="px-3 py-1.5">Prod</th><th className="px-3 py-1.5">Updated</th><th className="px-3 py-1.5"></th></tr></thead>
              <tbody>
                {flagsQ.data.map((f) => (
                  <tr key={f.key} className="border-t border-border-subtle/40 text-fg-secondary">
                    <td className="px-3 py-1.5 font-mono">{f.key}</td>
                    <td className="px-3 py-1.5 font-mono">{JSON.stringify(f.value)}</td>
                    <td className="px-3 py-1.5">{f.allow_prod ? 'yes' : 'no'}</td>
                    <td className="px-3 py-1.5">{new Date(f.updated_at).toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right">
                      {canWrite && typeof f.value === 'boolean' ? (
                        <button type="button" onClick={() => void setFlag(f.key, !f.value)} className="text-accent-primary hover:underline">toggle</button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-3 text-sm text-fg-muted">No flags defined.</p>
          )}
        </div>
      </section>
    </div>
  );
}
