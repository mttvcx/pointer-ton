'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminFetch, useAdminMe, adminCan } from '@/lib/admin/useAdminApi';

type SearchRow = {
  id: string;
  privy_id: string;
  wallet_address: string | null;
  username: string | null;
  email: string | null;
  tier_id: string;
  created_at: string;
};

type Profile = {
  user: Record<string, unknown> & { id: string; tier_id: string; created_at: string };
  wallets: { id: string; wallet_address: string; label: string | null; is_primary: boolean; is_imported?: boolean; is_archived?: boolean }[];
  points: { total: number; breakdown: Record<string, number> };
  referrals: { code: string | null; referredCount: number; earningsLamports: number; unpaidLamports: number };
  cashbackSol: number;
};

const LAMPORTS = 1_000_000_000;

export default function AdminUsersPage() {
  const adminFetch = useAdminFetch();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const searchQ = useQuery({
    queryKey: ['admin-users-search', submitted],
    queryFn: async (): Promise<SearchRow[]> => {
      const res = await adminFetch(`/api/admin/users?q=${encodeURIComponent(submitted)}`);
      if (!res.ok) throw new Error(`search_${res.status}`);
      const json = (await res.json()) as { users: SearchRow[] };
      return json.users;
    },
  });

  const profileQ = useQuery({
    queryKey: ['admin-user-profile', selected],
    enabled: Boolean(selected),
    queryFn: async (): Promise<Profile> => {
      const res = await adminFetch(`/api/admin/users/${selected}`);
      if (!res.ok) throw new Error(`profile_${res.status}`);
      const json = (await res.json()) as { profile: Profile };
      return json.profile;
    },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-semibold text-fg-primary">Users</h1>
        <p className="mt-1 text-sm text-fg-muted">Search by wallet, username, email, privy id or user id.</p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users…"
          className="flex-1 rounded-md border border-border-subtle bg-bg-base px-3 py-1.5 text-sm text-fg-primary"
        />
        <button type="submit" className="rounded-md bg-accent-primary px-3 py-1.5 text-sm font-semibold text-fg-inverse">
          Search
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-md border border-border-subtle bg-bg-raised">
          <div className="border-b border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Results {searchQ.data ? `(${searchQ.data.length})` : ''}
          </div>
          <div className="max-h-[60vh] overflow-auto">
            {searchQ.isLoading ? (
              <p className="p-3 text-sm text-fg-muted">Loading…</p>
            ) : searchQ.data && searchQ.data.length > 0 ? (
              <ul className="divide-y divide-border-subtle/50">
                {searchQ.data.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(u.id)}
                      className={`w-full px-3 py-2 text-left text-[13px] transition-colors hover:bg-bg-hover/60 ${selected === u.id ? 'bg-bg-hover' : ''}`}
                    >
                      <div className="font-medium text-fg-primary">{u.username ?? u.wallet_address ?? u.id}</div>
                      <div className="truncate font-mono text-[11px] text-fg-muted">{u.wallet_address ?? '—'}</div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-3 text-sm text-fg-muted">No results.</p>
            )}
          </div>
        </section>

        <section className="rounded-md border border-border-subtle bg-bg-raised">
          <div className="border-b border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Profile
          </div>
          <div className="max-h-[60vh] overflow-auto p-3 text-[13px]">
            {!selected ? (
              <p className="text-fg-muted">Select a user to view their profile.</p>
            ) : profileQ.isLoading ? (
              <p className="text-fg-muted">Loading…</p>
            ) : profileQ.data ? (
              <ProfileView p={profileQ.data} userId={selected!} />
            ) : (
              <p className="text-rose-400">Could not load profile.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ProfileView({ p, userId }: { p: Profile; userId: string }) {
  return (
    <div className="space-y-4">
      <AccountGuardianPanel userId={userId} />
      <AccountRescuePanel userId={userId} />
      <div>
        <h3 className="text-sm font-semibold text-fg-primary">{String(p.user.username ?? p.user.id)}</h3>
        <dl className="mt-1 space-y-0.5 text-[12px] text-fg-secondary">
          <div className="flex justify-between gap-4"><dt className="text-fg-muted">User id</dt><dd className="font-mono">{p.user.id}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-fg-muted">Tier</dt><dd>{p.user.tier_id}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-fg-muted">Created</dt><dd>{new Date(p.user.created_at).toLocaleString()}</dd></div>
        </dl>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Linked wallets ({p.wallets.length})</h4>
        <ul className="mt-1 space-y-1">
          {p.wallets.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-2 font-mono text-[11px] text-fg-secondary">
              <span className="truncate">{w.wallet_address}</span>
              <span className="shrink-0 text-fg-muted">
                {w.is_primary ? 'primary' : ''} {w.is_imported ? 'imported' : ''} {w.is_archived ? 'archived' : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md bg-bg-base p-2">
          <div className="text-xs text-fg-muted">Points</div>
          <div className="text-base font-semibold tabular-nums text-fg-primary">{p.points.total.toLocaleString()}</div>
        </div>
        <div className="rounded-md bg-bg-base p-2">
          <div className="text-xs text-fg-muted">Referrals</div>
          <div className="text-base font-semibold tabular-nums text-fg-primary">{p.referrals.referredCount}</div>
          <div className="text-[11px] text-fg-muted">code: {p.referrals.code ?? '—'}</div>
        </div>
        <div className="rounded-md bg-bg-base p-2">
          <div className="text-xs text-fg-muted">Ref earnings (SOL)</div>
          <div className="text-base font-semibold tabular-nums text-fg-primary">{(p.referrals.earningsLamports / LAMPORTS).toFixed(4)}</div>
        </div>
        <div className="rounded-md bg-bg-base p-2">
          <div className="text-xs text-fg-muted">Unpaid (SOL)</div>
          <div className="text-base font-semibold tabular-nums text-fg-primary">{(p.referrals.unpaidLamports / LAMPORTS).toFixed(4)}</div>
        </div>
        <div className="rounded-md bg-bg-base p-2">
          <div className="text-xs text-fg-muted">Cashback (SOL)</div>
          <div className="text-base font-semibold tabular-nums text-fg-primary">{p.cashbackSol.toFixed(4)}</div>
        </div>
      </div>
    </div>
  );
}

type AccountControl = {
  id: string;
  status: string;
  scope: string;
  reason: string;
  created_at: string;
  released_at: string | null;
  released_reason: string | null;
};

/**
 * Emergency Account Guardian — superadmin-only kill switch. Freezing blocks the
 * server-side quote builder, so a hijacked copy-trade/autobuy can no longer mint
 * swap transactions to drain the wallet (works for every wallet type). This is a
 * protective stop, not key custody.
 */
function AccountGuardianPanel({ userId }: { userId: string }) {
  const adminFetch = useAdminFetch();
  const qc = useQueryClient();
  const meQ = useAdminMe();
  const [scope, setScope] = useState<'all' | 'trading' | 'automation'>('all');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canControl = adminCan(meQ.data, 'account.control');

  const statusQ = useQuery({
    queryKey: ['admin-account-control', userId],
    enabled: canControl,
    queryFn: async (): Promise<{ active: AccountControl | null; history: AccountControl[] }> => {
      const res = await adminFetch(`/api/admin/accounts/${userId}`);
      if (!res.ok) throw new Error(`status_${res.status}`);
      return (await res.json()) as { active: AccountControl | null; history: AccountControl[] };
    },
  });

  if (!canControl) return null;

  const active = statusQ.data?.active ?? null;

  async function submit(path: 'freeze' | 'release') {
    if (reason.trim().length < 8) {
      setErr('Reason must be at least 8 characters.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const body = path === 'freeze' ? { scope, reason: reason.trim() } : { reason: reason.trim() };
      const res = await adminFetch(`/api/admin/accounts/${userId}/${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(j.message ?? j.error ?? `${path}_failed`);
      }
      setReason('');
      await qc.invalidateQueries({ queryKey: ['admin-account-control', userId] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'request_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`rounded-md border p-3 ${active ? 'border-rose-500/50 bg-rose-500/[0.06]' : 'border-amber-500/40 bg-amber-500/[0.04]'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-primary">
          Account Guardian
        </h4>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${active ? 'bg-rose-500/20 text-rose-300' : 'bg-bg-base text-fg-muted'}`}
        >
          {active ? `Frozen · ${active.scope}` : 'Active'}
        </span>
      </div>

      <p className="mt-1 text-[11px] leading-snug text-fg-muted">
        Step 1 — emergency stop. Freezing blocks new orders server-side (manual, quick-buy,
        autobuy, copy-trade). The user sees a generic trading-disabled message; no admin alert.
      </p>

      {active ? (
        <div className="mt-2 rounded bg-bg-base/60 px-2 py-1.5 text-[11px] text-fg-secondary">
          <div>Reason: {active.reason}</div>
          <div className="text-fg-muted">Since {new Date(active.created_at).toLocaleString()}</div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1">
          {(['all', 'trading', 'automation'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`rounded px-2 py-0.5 text-[11px] capitalize ${scope === s ? 'bg-accent-primary text-fg-inverse' : 'bg-bg-base text-fg-secondary hover:bg-bg-hover'}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={active ? 'Reason to release…' : 'Reason to freeze (required)…'}
        className="mt-2 w-full rounded-md border border-border-subtle bg-bg-base px-2.5 py-1.5 text-[12px] text-fg-primary"
      />

      {err ? <p className="mt-1 text-[11px] text-rose-400">{err}</p> : null}

      <div className="mt-2 flex gap-2">
        {active ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit('release')}
            className="rounded-md bg-signal-bull/20 px-3 py-1.5 text-[12px] font-semibold text-signal-bull disabled:opacity-50"
          >
            {busy ? 'Releasing…' : 'Release freeze'}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit('freeze')}
            className="rounded-md bg-rose-500/20 px-3 py-1.5 text-[12px] font-semibold text-rose-300 disabled:opacity-50"
          >
            {busy ? 'Freezing…' : 'Freeze account'}
          </button>
        )}
      </div>
    </div>
  );
}

type RescueWalletRow = {
  walletAddress: string;
  isPrimary: boolean;
  rescue: {
    configured: boolean;
    hasAppSigner: boolean;
    walletId: string | null;
    chain: 'solana' | null;
  };
  splTokenCount: number;
};

type RescueStatus = {
  serverSignerConfigured: boolean;
  privyUser: boolean;
  wallets: RescueWalletRow[];
  recentActions: {
    id: string;
    action: string;
    wallet_address: string;
    mint: string | null;
    status: string;
    tx_signature: string | null;
    reason: string;
    created_at: string;
    error_message: string | null;
  }[];
};

/**
 * Step 2 — server-signed protective sells on Privy embedded wallets. Silent to the
 * user; on-chain activity looks like a normal swap. Freeze first (Step 1) to block
 * new attacker orders while you rescue funds.
 */
function AccountRescuePanel({ userId }: { userId: string }) {
  const adminFetch = useAdminFetch();
  const qc = useQueryClient();
  const meQ = useAdminMe();
  const [walletAddress, setWalletAddress] = useState('');
  const [mint, setMint] = useState('');
  const [sellAll, setSellAll] = useState(true);
  const [sellPct, setSellPct] = useState(100);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastSig, setLastSig] = useState<string | null>(null);

  const canRescue = adminCan(meQ.data, 'account.emergency_sell');

  const rescueQ = useQuery({
    queryKey: ['admin-account-rescue', userId],
    enabled: canRescue,
    queryFn: async (): Promise<RescueStatus> => {
      const res = await adminFetch(`/api/admin/accounts/${userId}/rescue`);
      if (!res.ok) throw new Error(`rescue_status_${res.status}`);
      return (await res.json()) as RescueStatus;
    },
  });

  if (!canRescue) return null;

  const wallets = rescueQ.data?.wallets ?? [];
  const selectedWallet = walletAddress || wallets[0]?.walletAddress || '';
  const selectedRow = wallets.find((w) => w.walletAddress === selectedWallet);
  const signerReady =
    Boolean(rescueQ.data?.serverSignerConfigured) &&
    Boolean(selectedRow?.rescue.hasAppSigner);
  const canSell = signerReady && selectedWallet.length >= 32;

  async function submitSell() {
    if (reason.trim().length < 8) {
      setErr('Reason must be at least 8 characters.');
      return;
    }
    if (!selectedWallet) {
      setErr('Select a wallet.');
      return;
    }
    if (!sellAll && mint.trim().length < 32) {
      setErr('Mint address required unless selling all tokens.');
      return;
    }
    setBusy(true);
    setErr(null);
    setLastSig(null);
    try {
      const res = await adminFetch(`/api/admin/accounts/${userId}/emergency-sell`, {
        method: 'POST',
        body: JSON.stringify({
          walletAddress: selectedWallet,
          sellAll,
          mint: sellAll ? undefined : mint.trim(),
          sellPct,
          reason: reason.trim(),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        result?: { signature: string };
        results?: { signature: string }[];
      };
      if (!res.ok) throw new Error(j.error ?? 'emergency_sell_failed');
      const sig = j.result?.signature ?? j.results?.[j.results.length - 1]?.signature ?? null;
      setLastSig(sig);
      setReason('');
      await qc.invalidateQueries({ queryKey: ['admin-account-rescue', userId] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'request_failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-violet-500/35 bg-violet-500/[0.04] p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-primary">
          Emergency rescue
        </h4>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${signerReady ? 'bg-signal-bull/15 text-signal-bull' : 'bg-bg-base text-fg-muted'}`}
        >
          {signerReady ? 'Signer ready' : 'Signer missing'}
        </span>
      </div>

      <p className="mt-1 text-[11px] leading-snug text-fg-muted">
        Step 2 — sell tokens to SOL via Privy server signing. No in-app alert to the user.
        External/imported wallets are freeze-only.
      </p>

      {rescueQ.isLoading ? (
        <p className="mt-2 text-[11px] text-fg-muted">Loading rescue status…</p>
      ) : rescueQ.isError ? (
        <p className="mt-2 text-[11px] text-rose-400">Could not load rescue status.</p>
      ) : (
        <>
          {!rescueQ.data?.serverSignerConfigured ? (
            <p className="mt-2 rounded bg-bg-base/60 px-2 py-1.5 text-[11px] text-amber-300">
              Server signer not configured — set PRIVY_AUTHORIZATION_PRIVATE_KEY and
              PRIVY_SIGNER_KEY_QUORUM_ID in .env.local, then reload PostgREST.
            </p>
          ) : null}

          {!rescueQ.data?.privyUser ? (
            <p className="mt-2 text-[11px] text-fg-muted">User has no Privy account — rescue unavailable.</p>
          ) : wallets.length === 0 ? (
            <p className="mt-2 text-[11px] text-fg-muted">No embedded trading wallets on file.</p>
          ) : (
            <div className="mt-2 space-y-2">
              <label className="block text-[11px] text-fg-muted">
                Wallet
                <select
                  value={selectedWallet}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="mt-0.5 w-full rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 font-mono text-[11px] text-fg-primary"
                >
                  {wallets.map((w) => (
                    <option key={w.walletAddress} value={w.walletAddress}>
                      {w.walletAddress.slice(0, 4)}…{w.walletAddress.slice(-4)}
                      {w.isPrimary ? ' · primary' : ''}
                      {w.rescue.hasAppSigner ? ' · signer' : ' · no signer'}
                      {` · ${w.splTokenCount} SPL`}
                    </option>
                  ))}
                </select>
              </label>

              {selectedRow && !selectedRow.rescue.hasAppSigner ? (
                <p className="text-[11px] text-amber-300">
                  No server signer on this wallet — victim must log in once after signer env is live.
                </p>
              ) : null}

              <label className="flex items-center gap-2 text-[11px] text-fg-secondary">
                <input
                  type="checkbox"
                  checked={sellAll}
                  onChange={(e) => setSellAll(e.target.checked)}
                  className="rounded border-border-subtle"
                />
                Sell all SPL tokens (up to 12, 100% each)
              </label>

              {!sellAll ? (
                <input
                  value={mint}
                  onChange={(e) => setMint(e.target.value)}
                  placeholder="Token mint address…"
                  className="w-full rounded-md border border-border-subtle bg-bg-base px-2.5 py-1.5 font-mono text-[11px] text-fg-primary"
                />
              ) : null}

              {!sellAll ? (
                <label className="block text-[11px] text-fg-muted">
                  Sell %
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={sellPct}
                    onChange={(e) => setSellPct(Number(e.target.value))}
                    className="mt-0.5 w-20 rounded-md border border-border-subtle bg-bg-base px-2 py-1 text-[12px] tabular-nums text-fg-primary"
                  />
                </label>
              ) : null}

              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (required, audited)…"
                className="w-full rounded-md border border-border-subtle bg-bg-base px-2.5 py-1.5 text-[12px] text-fg-primary"
              />

              {err ? <p className="text-[11px] text-rose-400">{err}</p> : null}
              {lastSig ? (
                <p className="font-mono text-[10px] text-signal-bull">
                  Confirmed: {lastSig.slice(0, 8)}…{lastSig.slice(-8)}
                </p>
              ) : null}

              <button
                type="button"
                disabled={busy || !canSell}
                onClick={() => void submitSell()}
                className="rounded-md bg-violet-500/25 px-3 py-1.5 text-[12px] font-semibold text-violet-200 disabled:opacity-50"
              >
                {busy ? 'Selling…' : sellAll ? 'Emergency sell all' : 'Emergency sell'}
              </button>
            </div>
          )}

          {(rescueQ.data?.recentActions.length ?? 0) > 0 ? (
            <div className="mt-3 border-t border-border-subtle pt-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                Recent rescue actions
              </div>
              <ul className="mt-1 max-h-28 space-y-1 overflow-auto text-[10px] text-fg-secondary">
                {rescueQ.data!.recentActions.map((a) => (
                  <li key={a.id} className="font-mono">
                    <span className={a.status === 'confirmed' ? 'text-signal-bull' : a.status === 'failed' ? 'text-rose-400' : 'text-fg-muted'}>
                      {a.status}
                    </span>{' '}
                    · {a.action} · {new Date(a.created_at).toLocaleString()}
                    {a.tx_signature ? ` · ${a.tx_signature.slice(0, 8)}…` : ''}
                    {a.error_message ? ` · ${a.error_message}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
