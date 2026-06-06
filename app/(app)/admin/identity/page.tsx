'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminFetch, useAdminMe, adminCan } from '@/lib/admin/useAdminApi';

type Profile = {
  id: string;
  display_name: string;
  primary_category: string;
  verified: boolean;
  twitter_handle: string | null;
  updated_at: string;
};

type Wallet = { id: string; chain: string; address: string; label: string | null; source: string; verified: boolean };

export default function AdminIdentityPage() {
  const adminFetch = useAdminFetch();
  const qc = useQueryClient();
  const me = useAdminMe().data;
  const canWrite = adminCan(me, 'identity.write');

  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({ displayName: '', twitterHandle: '', notes: '' });
  const [walletForm, setWalletForm] = useState({ chain: 'sol', address: '', label: '' });

  const profilesQ = useQuery({
    queryKey: ['admin-identity-profiles', submitted],
    queryFn: async (): Promise<Profile[]> => {
      const res = await adminFetch(`/api/admin/identity/profiles${submitted ? `?search=${encodeURIComponent(submitted)}` : ''}`);
      if (!res.ok) throw new Error(`profiles_${res.status}`);
      return (await res.json()).profiles as Profile[];
    },
  });

  const detailQ = useQuery({
    queryKey: ['admin-identity-detail', selected],
    enabled: Boolean(selected),
    queryFn: async (): Promise<{ profile: Profile; wallets: Wallet[] }> => {
      const res = await adminFetch(`/api/admin/identity/profiles/${selected}`);
      if (!res.ok) throw new Error(`detail_${res.status}`);
      return (await res.json()) as { profile: Profile; wallets: Wallet[] };
    },
  });

  async function createProfile() {
    setMsg(null);
    const res = await adminFetch('/api/admin/identity/profiles', {
      method: 'POST',
      body: JSON.stringify({
        displayName: profileForm.displayName.trim(),
        twitterHandle: profileForm.twitterHandle.trim() || undefined,
        notes: profileForm.notes.trim() || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setMsg(json.error ?? 'create_failed'); return; }
    setProfileForm({ displayName: '', twitterHandle: '', notes: '' });
    void qc.invalidateQueries({ queryKey: ['admin-identity-profiles'] });
  }

  async function addWallet() {
    if (!selected) return;
    setMsg(null);
    const res = await adminFetch(`/api/admin/identity/profiles/${selected}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'add_wallet', chain: walletForm.chain, address: walletForm.address.trim(), label: walletForm.label.trim() || undefined, source: 'admin' }),
    });
    const json = await res.json();
    if (!res.ok) { setMsg(json.error ?? 'add_wallet_failed'); return; }
    setWalletForm({ chain: 'sol', address: '', label: '' });
    void qc.invalidateQueries({ queryKey: ['admin-identity-detail', selected] });
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-semibold text-fg-primary">Identity labels</h1>
        <p className="mt-1 text-sm text-fg-muted">Persistent identity profiles and their wallet labels.</p>
      </header>
      {msg ? <p className="text-[13px] text-rose-400">{msg}</p> : null}

      {canWrite ? (
        <section className="rounded-md border border-border-subtle bg-bg-raised p-4">
          <h2 className="text-sm font-semibold text-fg-primary">New profile</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" placeholder="Display name" value={profileForm.displayName} onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })} />
            <input className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" placeholder="Twitter handle" value={profileForm.twitterHandle} onChange={(e) => setProfileForm({ ...profileForm, twitterHandle: e.target.value })} />
            <input className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" placeholder="Notes" value={profileForm.notes} onChange={(e) => setProfileForm({ ...profileForm, notes: e.target.value })} />
          </div>
          <button type="button" onClick={() => void createProfile()} className="mt-3 rounded-md bg-accent-primary px-3 py-1.5 text-[13px] font-semibold text-fg-inverse">Create profile</button>
        </section>
      ) : null}

      <form onSubmit={(e) => { e.preventDefault(); setSubmitted(search.trim()); }} className="flex gap-2">
        <input className="flex-1 rounded-md border border-border-subtle bg-bg-base px-3 py-1.5 text-sm" placeholder="Search profiles…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="submit" className="rounded-md bg-accent-primary px-3 py-1.5 text-sm font-semibold text-fg-inverse">Search</button>
      </form>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-border-subtle bg-bg-raised">
          <div className="border-b border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Profiles</div>
          <div className="max-h-[55vh] overflow-auto">
            {profilesQ.data && profilesQ.data.length > 0 ? (
              <ul className="divide-y divide-border-subtle/50">
                {profilesQ.data.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => setSelected(p.id)} className={`w-full px-3 py-2 text-left text-[13px] hover:bg-bg-hover/60 ${selected === p.id ? 'bg-bg-hover' : ''}`}>
                      <span className="font-medium text-fg-primary">{p.display_name}</span>
                      {p.verified ? <span className="ml-2 text-[11px] text-signal-bull">verified</span> : null}
                      <span className="ml-2 text-[11px] text-fg-muted">{p.primary_category}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-3 text-sm text-fg-muted">No profiles.</p>
            )}
          </div>
        </section>

        <section className="rounded-md border border-border-subtle bg-bg-raised">
          <div className="border-b border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Wallets</div>
          <div className="max-h-[55vh] overflow-auto p-3 text-[13px]">
            {!selected ? (
              <p className="text-fg-muted">Select a profile.</p>
            ) : detailQ.data ? (
              <div className="space-y-3">
                <ul className="space-y-1">
                  {detailQ.data.wallets.map((w) => (
                    <li key={w.id} className="flex items-center justify-between gap-2 font-mono text-[11px] text-fg-secondary">
                      <span className="truncate">[{w.chain}] {w.address}</span>
                      <span className="shrink-0 text-fg-muted">{w.label ?? ''}</span>
                    </li>
                  ))}
                  {detailQ.data.wallets.length === 0 ? <li className="text-fg-muted">No wallets linked.</li> : null}
                </ul>
                {canWrite ? (
                  <div className="flex flex-col gap-2 border-t border-border-subtle/50 pt-3">
                    <select className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" value={walletForm.chain} onChange={(e) => setWalletForm({ ...walletForm, chain: e.target.value })}>
                      {['sol', 'eth', 'bnb', 'base', 'ton'].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" placeholder="Address" value={walletForm.address} onChange={(e) => setWalletForm({ ...walletForm, address: e.target.value })} />
                    <input className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]" placeholder="Label (optional)" value={walletForm.label} onChange={(e) => setWalletForm({ ...walletForm, label: e.target.value })} />
                    <button type="button" onClick={() => void addWallet()} className="self-start rounded-md bg-accent-primary px-3 py-1.5 text-[13px] font-semibold text-fg-inverse">Add wallet</button>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-fg-muted">Loading…</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
