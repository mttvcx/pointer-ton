'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminFetch, useAdminMe, adminCan } from '@/lib/admin/useAdminApi';

type Override = {
  id: string;
  target_user_id: string;
  pack_type: string | null;
  forced_outcome: string;
  reason: string;
  status: string;
  requires_approval: boolean;
  created_by: string | null;
  expires_at: string;
  created_at: string;
};

type PackOpen = {
  id: string;
  open_id: string;
  user_id: string | null;
  pack_type: string;
  highlight_rarity: string | null;
  is_override: boolean;
  created_at: string;
};

export default function AdminPacksPage() {
  const adminFetch = useAdminFetch();
  const qc = useQueryClient();
  const me = useAdminMe().data;

  const overridesQ = useQuery({
    queryKey: ['admin-pack-overrides'],
    queryFn: async (): Promise<Override[]> => {
      const res = await adminFetch('/api/admin/packs/overrides');
      if (!res.ok) throw new Error(`overrides_${res.status}`);
      return (await res.json()).overrides as Override[];
    },
  });

  const opensQ = useQuery({
    queryKey: ['admin-pack-opens'],
    queryFn: async (): Promise<PackOpen[]> => {
      const res = await adminFetch('/api/admin/packs/opens?limit=50');
      if (!res.ok) throw new Error(`opens_${res.status}`);
      return (await res.json()).opens as PackOpen[];
    },
  });

  const [form, setForm] = useState({ targetUserId: '', packType: '', forcedOutcome: 'epic_surge', reason: '', expiresAt: '' });
  const [msg, setMsg] = useState<string | null>(null);

  async function createOverride() {
    setMsg(null);
    try {
      const res = await adminFetch('/api/admin/packs/overrides', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: form.targetUserId.trim(),
          packType: form.packType ? form.packType : null,
          forcedOutcome: form.forcedOutcome,
          reason: form.reason.trim(),
          expiresAt: new Date(form.expiresAt).toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `create_${res.status}`);
      setMsg('Override created.');
      void qc.invalidateQueries({ queryKey: ['admin-pack-overrides'] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'create_failed');
    }
  }

  async function act(id: string, action: 'approve' | 'reject') {
    const reason = action === 'reject' ? window.prompt('Reason for rejection?') ?? '' : undefined;
    if (action === 'reject' && !reason) return;
    const res = await adminFetch(`/api/admin/packs/overrides/${id}`, {
      method: 'POST',
      body: JSON.stringify({ action, reason }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error ?? `${action}_failed`);
      return;
    }
    void qc.invalidateQueries({ queryKey: ['admin-pack-overrides'] });
  }

  const canOverride = adminCan(me, 'packs.override');
  const canApprove = adminCan(me, 'packs.override.approve');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-semibold text-fg-primary">Packs</h1>
        <p className="mt-1 text-sm text-fg-muted">Open history and the override queue. High-value outcomes require a second admin to approve.</p>
      </header>

      {canOverride ? (
        <section className="rounded-md border border-border-subtle bg-bg-raised p-4">
          <h2 className="text-sm font-semibold text-fg-primary">Create override (guaranteed next-pack result)</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" placeholder="Target user id (uuid)" value={form.targetUserId} onChange={(e) => setForm({ ...form, targetUserId: e.target.value })} />
            <select className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" value={form.packType} onChange={(e) => setForm({ ...form, packType: e.target.value })}>
              <option value="">Any pack type</option>
              <option value="bronze">bronze</option>
              <option value="silver">silver</option>
              <option value="gold">gold</option>
              <option value="legendary">legendary</option>
            </select>
            <select className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" value={form.forcedOutcome} onChange={(e) => setForm({ ...form, forcedOutcome: e.target.value })}>
              <option value="epic_surge">epic_surge (auto-approved)</option>
              <option value="legendary_elite">legendary_elite (needs approval)</option>
              <option value="jackpot">jackpot (needs approval)</option>
            </select>
            <input type="datetime-local" className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            <input className="sm:col-span-2 rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" placeholder="Reason (required, min 8 chars)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <button type="button" onClick={() => void createOverride()} className="mt-3 rounded-md bg-accent-primary px-3 py-1.5 text-[13px] font-semibold text-fg-inverse">
            Create override
          </button>
          {msg ? <p className="mt-2 text-[12px] text-fg-muted">{msg}</p> : null}
        </section>
      ) : null}

      <section className="rounded-md border border-border-subtle bg-bg-raised">
        <div className="border-b border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Override queue</div>
        <div className="max-h-[40vh] overflow-auto">
          {overridesQ.data && overridesQ.data.length > 0 ? (
            <table className="w-full text-[12px]">
              <thead className="text-fg-muted">
                <tr className="text-left">
                  <th className="px-3 py-1.5">Outcome</th><th className="px-3 py-1.5">Target</th><th className="px-3 py-1.5">Pack</th><th className="px-3 py-1.5">Status</th><th className="px-3 py-1.5">Expires</th><th className="px-3 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {overridesQ.data.map((o) => (
                  <tr key={o.id} className="border-t border-border-subtle/40 text-fg-secondary">
                    <td className="px-3 py-1.5">{o.forced_outcome}</td>
                    <td className="px-3 py-1.5 font-mono">{o.target_user_id.slice(0, 8)}…</td>
                    <td className="px-3 py-1.5">{o.pack_type ?? 'any'}</td>
                    <td className="px-3 py-1.5">{o.status}</td>
                    <td className="px-3 py-1.5">{new Date(o.expires_at).toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right">
                      {o.status === 'pending' && canApprove ? (
                        <span className="flex justify-end gap-2">
                          <button type="button" onClick={() => void act(o.id, 'approve')} className="text-signal-bull hover:underline">approve</button>
                          <button type="button" onClick={() => void act(o.id, 'reject')} className="text-signal-bear hover:underline">reject</button>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-3 text-sm text-fg-muted">No overrides.</p>
          )}
        </div>
      </section>

      <section className="rounded-md border border-border-subtle bg-bg-raised">
        <div className="border-b border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Recent opens</div>
        <div className="max-h-[40vh] overflow-auto">
          {opensQ.data && opensQ.data.length > 0 ? (
            <table className="w-full text-[12px]">
              <thead className="text-fg-muted">
                <tr className="text-left"><th className="px-3 py-1.5">When</th><th className="px-3 py-1.5">Pack</th><th className="px-3 py-1.5">Highlight</th><th className="px-3 py-1.5">User</th><th className="px-3 py-1.5">Override</th></tr>
              </thead>
              <tbody>
                {opensQ.data.map((o) => (
                  <tr key={o.id} className="border-t border-border-subtle/40 text-fg-secondary">
                    <td className="px-3 py-1.5">{new Date(o.created_at).toLocaleString()}</td>
                    <td className="px-3 py-1.5">{o.pack_type}</td>
                    <td className="px-3 py-1.5">{o.highlight_rarity ?? '—'}</td>
                    <td className="px-3 py-1.5 font-mono">{o.user_id ? `${o.user_id.slice(0, 8)}…` : 'anon'}</td>
                    <td className="px-3 py-1.5">{o.is_override ? 'yes' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-3 text-sm text-fg-muted">No opens recorded yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
