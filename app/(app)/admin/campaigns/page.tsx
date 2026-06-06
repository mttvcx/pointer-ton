'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminFetch, useAdminMe, adminCan } from '@/lib/admin/useAdminApi';

type Campaign = { id: string; name: string; grant_type: string; status: string; created_at: string };
type Grant = { id: string; campaign_id: string | null; target_user_id: string; grant_type: string; amount: number; reason: string; created_at: string };

export default function AdminCampaignsPage() {
  const adminFetch = useAdminFetch();
  const qc = useQueryClient();
  const me = useAdminMe().data;
  const [msg, setMsg] = useState<string | null>(null);

  const campaignsQ = useQuery({
    queryKey: ['admin-campaigns'],
    queryFn: async (): Promise<Campaign[]> => {
      const res = await adminFetch('/api/admin/campaigns');
      if (!res.ok) throw new Error(`campaigns_${res.status}`);
      return (await res.json()).campaigns as Campaign[];
    },
  });

  const grantsQ = useQuery({
    queryKey: ['admin-grants'],
    queryFn: async (): Promise<Grant[]> => {
      const res = await adminFetch('/api/admin/campaigns/grants');
      if (!res.ok) throw new Error(`grants_${res.status}`);
      return (await res.json()).grants as Grant[];
    },
  });

  const [campaign, setCampaign] = useState({ name: '', grantType: 'points', reason: '' });
  const [grant, setGrant] = useState({ campaignId: '', targetUserId: '', grantType: 'points', amount: '', reason: '' });

  const canGrant = adminCan(me, 'campaigns.grant');

  async function createCampaign() {
    setMsg(null);
    const res = await adminFetch('/api/admin/campaigns', {
      method: 'POST',
      body: JSON.stringify({ name: campaign.name.trim(), grantType: campaign.grantType, reason: campaign.reason.trim() || undefined }),
    });
    const json = await res.json();
    if (!res.ok) { setMsg(json.error ?? 'create_failed'); return; }
    setMsg('Campaign created.');
    void qc.invalidateQueries({ queryKey: ['admin-campaigns'] });
  }

  async function issueGrant() {
    setMsg(null);
    const res = await adminFetch('/api/admin/campaigns/grants', {
      method: 'POST',
      body: JSON.stringify({
        campaignId: grant.campaignId || null,
        targetUserId: grant.targetUserId.trim(),
        grantType: grant.grantType,
        amount: Number(grant.amount),
        reason: grant.reason.trim(),
      }),
    });
    const json = await res.json();
    if (!res.ok) { setMsg(json.error ?? 'grant_failed'); return; }
    setMsg('Grant issued.');
    void qc.invalidateQueries({ queryKey: ['admin-grants'] });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-semibold text-fg-primary">Campaigns &amp; grants</h1>
        <p className="mt-1 text-sm text-fg-muted">Create campaigns and issue points/cashback grants. Grants apply the real effect and are audited.</p>
      </header>
      {msg ? <p className="text-[13px] text-fg-secondary">{msg}</p> : null}

      {canGrant ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-md border border-border-subtle bg-bg-raised p-4">
            <h2 className="text-sm font-semibold text-fg-primary">New campaign</h2>
            <div className="mt-3 flex flex-col gap-2">
              <input className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" placeholder="Name" value={campaign.name} onChange={(e) => setCampaign({ ...campaign, name: e.target.value })} />
              <select className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" value={campaign.grantType} onChange={(e) => setCampaign({ ...campaign, grantType: e.target.value })}>
                <option value="points">points</option>
                <option value="cashback">cashback</option>
              </select>
              <input className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" placeholder="Reason (optional)" value={campaign.reason} onChange={(e) => setCampaign({ ...campaign, reason: e.target.value })} />
              <button type="button" onClick={() => void createCampaign()} className="self-start rounded-md bg-accent-primary px-3 py-1.5 text-[13px] font-semibold text-fg-inverse">Create</button>
            </div>
          </section>

          <section className="rounded-md border border-border-subtle bg-bg-raised p-4">
            <h2 className="text-sm font-semibold text-fg-primary">Issue grant</h2>
            <div className="mt-3 flex flex-col gap-2">
              <select className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" value={grant.campaignId} onChange={(e) => setGrant({ ...grant, campaignId: e.target.value })}>
                <option value="">No campaign</option>
                {(campaignsQ.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" placeholder="Target user id" value={grant.targetUserId} onChange={(e) => setGrant({ ...grant, targetUserId: e.target.value })} />
              <select className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" value={grant.grantType} onChange={(e) => setGrant({ ...grant, grantType: e.target.value })}>
                <option value="points">points</option>
                <option value="cashback">cashback (SOL)</option>
              </select>
              <input className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" placeholder="Amount" value={grant.amount} onChange={(e) => setGrant({ ...grant, amount: e.target.value })} />
              <input className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" placeholder="Reason (min 8 chars)" value={grant.reason} onChange={(e) => setGrant({ ...grant, reason: e.target.value })} />
              <button type="button" onClick={() => void issueGrant()} className="self-start rounded-md bg-accent-primary px-3 py-1.5 text-[13px] font-semibold text-fg-inverse">Issue grant</button>
            </div>
          </section>
        </div>
      ) : null}

      <section className="rounded-md border border-border-subtle bg-bg-raised">
        <div className="border-b border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Recent grants</div>
        <div className="max-h-[40vh] overflow-auto">
          {grantsQ.data && grantsQ.data.length > 0 ? (
            <table className="w-full text-[12px]">
              <thead className="text-fg-muted"><tr className="text-left"><th className="px-3 py-1.5">When</th><th className="px-3 py-1.5">Type</th><th className="px-3 py-1.5">Amount</th><th className="px-3 py-1.5">Target</th><th className="px-3 py-1.5">Reason</th></tr></thead>
              <tbody>
                {grantsQ.data.map((g) => (
                  <tr key={g.id} className="border-t border-border-subtle/40 text-fg-secondary">
                    <td className="px-3 py-1.5">{new Date(g.created_at).toLocaleString()}</td>
                    <td className="px-3 py-1.5">{g.grant_type}</td>
                    <td className="px-3 py-1.5 tabular-nums">{g.amount}</td>
                    <td className="px-3 py-1.5 font-mono">{g.target_user_id.slice(0, 8)}…</td>
                    <td className="px-3 py-1.5 truncate max-w-[200px]">{g.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-3 text-sm text-fg-muted">No grants yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
