'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAdminFetch, useAdminMe, adminCan } from '@/lib/admin/useAdminApi';

type Tier = { id: string; name: string; fee_bps: number; point_multiplier: number };

export default function AdminEconomyPage() {
  const adminFetch = useAdminFetch();
  const me = useAdminMe().data;
  const [msg, setMsg] = useState<string | null>(null);

  const tiersQ = useQuery({
    queryKey: ['admin-tiers'],
    queryFn: async (): Promise<Tier[]> => {
      const res = await adminFetch('/api/admin/economy/tier');
      if (!res.ok) throw new Error(`tiers_${res.status}`);
      return (await res.json()).tiers as Tier[];
    },
  });

  const [grant, setGrant] = useState({ targetUserId: '', amount: '', reason: '' });
  const [tierForm, setTierForm] = useState({ targetUserId: '', tierId: '', reason: '' });
  const [cashback, setCashback] = useState({ targetUserId: '', amountSol: '', reason: '' });
  const [payout, setPayout] = useState({ referrerId: '', earningIds: '', txSignature: '', reason: '' });

  async function call(path: string, payload: unknown) {
    setMsg(null);
    try {
      const res = await adminFetch(path, { method: 'POST', body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `err_${res.status}`);
      setMsg('Done.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'failed');
    }
  }

  const can = (p: string) => adminCan(me, p);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-semibold text-fg-primary">Economy</h1>
        <p className="mt-1 text-sm text-fg-muted">Point grants, tier assignment, referral payouts and cashback. Every action is audited.</p>
      </header>
      {msg ? <p className="text-[13px] text-fg-secondary">{msg}</p> : null}

      {can('points.grant') ? (
        <Card title="Grant points">
          <Field placeholder="Target user id" value={grant.targetUserId} onChange={(v) => setGrant({ ...grant, targetUserId: v })} />
          <Field placeholder="Amount" value={grant.amount} onChange={(v) => setGrant({ ...grant, amount: v })} />
          <Field placeholder="Reason (min 8 chars)" value={grant.reason} onChange={(v) => setGrant({ ...grant, reason: v })} />
          <Submit onClick={() => call('/api/admin/economy/points-grant', { targetUserId: grant.targetUserId.trim(), amount: Number(grant.amount), reason: grant.reason.trim() })} />
        </Card>
      ) : null}

      {can('users.write') ? (
        <Card title="Assign tier">
          <Field placeholder="Target user id" value={tierForm.targetUserId} onChange={(v) => setTierForm({ ...tierForm, targetUserId: v })} />
          <select className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" value={tierForm.tierId} onChange={(e) => setTierForm({ ...tierForm, tierId: e.target.value })}>
            <option value="">Select tier…</option>
            {(tiersQ.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
            ))}
          </select>
          <Field placeholder="Reason (min 8 chars)" value={tierForm.reason} onChange={(v) => setTierForm({ ...tierForm, reason: v })} />
          <Submit onClick={() => call('/api/admin/economy/tier', { targetUserId: tierForm.targetUserId.trim(), tierId: tierForm.tierId, reason: tierForm.reason.trim() })} />
        </Card>
      ) : null}

      {can('cashback.grant') ? (
        <Card title="Grant cashback (SOL)">
          <Field placeholder="Target user id" value={cashback.targetUserId} onChange={(v) => setCashback({ ...cashback, targetUserId: v })} />
          <Field placeholder="Amount SOL (negative = debit)" value={cashback.amountSol} onChange={(v) => setCashback({ ...cashback, amountSol: v })} />
          <Field placeholder="Reason (min 8 chars)" value={cashback.reason} onChange={(v) => setCashback({ ...cashback, reason: v })} />
          <Submit onClick={() => call('/api/admin/economy/cashback-grant', { targetUserId: cashback.targetUserId.trim(), amountSol: Number(cashback.amountSol), reason: cashback.reason.trim() })} />
        </Card>
      ) : null}

      {can('referrals.payout') ? (
        <Card title="Mark referral earnings paid">
          <Field placeholder="Referrer user id" value={payout.referrerId} onChange={(v) => setPayout({ ...payout, referrerId: v })} />
          <Field placeholder="Earning ids (comma separated)" value={payout.earningIds} onChange={(v) => setPayout({ ...payout, earningIds: v })} />
          <Field placeholder="Tx signature" value={payout.txSignature} onChange={(v) => setPayout({ ...payout, txSignature: v })} />
          <Field placeholder="Reason (min 8 chars)" value={payout.reason} onChange={(v) => setPayout({ ...payout, reason: v })} />
          <Submit onClick={() => call('/api/admin/economy/referrals/payout', { referrerId: payout.referrerId.trim(), earningIds: payout.earningIds.split(',').map((s) => s.trim()).filter(Boolean), txSignature: payout.txSignature.trim(), reason: payout.reason.trim() })} />
        </Card>
      ) : null}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border-subtle bg-bg-raised p-4">
      <h2 className="text-sm font-semibold text-fg-primary">{title}</h2>
      <div className="mt-3 flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Field({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <input
      className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px] text-fg-primary"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Submit({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="self-start rounded-md bg-accent-primary px-3 py-1.5 text-[13px] font-semibold text-fg-inverse">
      Submit
    </button>
  );
}
