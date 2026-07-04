'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminFetch, useAdminMe, adminCan } from '@/lib/admin/useAdminApi';

type Banner = { message: string; level: 'info' | 'warn' | 'critical' } | null;
type Controls = {
  trading: boolean;
  ai: boolean;
  packs: boolean;
  cashback: boolean;
  referral: boolean;
  chains: Record<'sol' | 'base' | 'eth' | 'bnb' | 'ton', boolean>;
  maintenance: boolean;
  readOnly: boolean;
  banner: Banner;
  updatedAt: string;
  updatedBy: string | null;
};

const FEATURES = [
  ['trading', 'Trading'],
  ['ai', 'AI'],
  ['packs', 'Packs'],
  ['cashback', 'Cashback'],
  ['referral', 'Referral'],
] as const;
const CHAINS = [
  ['sol', 'Solana'],
  ['base', 'Base'],
  ['eth', 'Ethereum'],
  ['bnb', 'BNB'],
  ['ton', 'TON'],
] as const;

export default function AdminEmergencyPage() {
  const adminFetch = useAdminFetch();
  const qc = useQueryClient();
  const me = useAdminMe().data;
  const canWrite = adminCan(me, 'emergency.control');
  const [reason, setReason] = useState('');
  const [bannerMsg, setBannerMsg] = useState('');
  const [bannerLevel, setBannerLevel] = useState<'info' | 'warn' | 'critical'>('warn');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ['admin-emergency'],
    queryFn: async (): Promise<Controls> => {
      const r = await adminFetch('/api/admin/emergency');
      if (!r.ok) throw new Error(`emergency_${r.status}`);
      return (await r.json()).controls as Controls;
    },
    refetchInterval: 10_000,
  });
  const c = q.data;

  async function patch(body: Record<string, unknown>) {
    if (!canWrite || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminFetch('/api/admin/emergency', {
        method: 'POST',
        body: JSON.stringify({ ...body, reason: reason.trim() || undefined }),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsg(j.message || j.error || 'change_failed');
        return;
      }
      void qc.invalidateQueries({ queryKey: ['admin-emergency'] });
    } finally {
      setBusy(false);
    }
  }

  function Pill({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
    return (
      <span
        className={
          'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ' +
          (on ? 'bg-signal-bull/15 text-signal-bull' : 'bg-signal-bear/15 text-signal-bear')
        }
      >
        {on ? onLabel : offLabel}
      </span>
    );
  }

  function Row({
    label,
    enabled,
    onToggle,
    enabledLabel = 'Enabled',
    disabledLabel = 'Paused',
    activeIsBad = false,
  }: {
    label: string;
    enabled: boolean;
    onToggle: (next: boolean) => void;
    enabledLabel?: string;
    disabledLabel?: string;
    activeIsBad?: boolean;
  }) {
    // For modes (maintenance/readOnly) "enabled" means the mode is ACTIVE (bad).
    const good = activeIsBad ? !enabled : enabled;
    return (
      <div className="flex items-center justify-between border-t border-border-subtle/40 px-3 py-2 first:border-t-0">
        <span className="text-[13px] font-medium text-fg-primary">{label}</span>
        <div className="flex items-center gap-3">
          <Pill on={good} onLabel={enabledLabel} offLabel={disabledLabel} />
          <button
            type="button"
            disabled={!canWrite || busy}
            onClick={() => onToggle(!enabled)}
            className={
              'rounded-md px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-40 ' +
              (good
                ? 'border border-signal-bear/40 text-signal-bear hover:bg-signal-bear/10'
                : 'bg-signal-bull px-2.5 text-fg-inverse hover:brightness-110')
            }
          >
            {good ? (activeIsBad ? 'Activate' : 'Pause') : activeIsBad ? 'Deactivate' : 'Resume'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-lg font-semibold text-fg-primary">Emergency control system</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Global kill switches, per-chain pauses, maintenance + read-only mode, and the user banner. Changes go live
          within ~5s, are fully reversible, and every change is audit-logged. Superadmin only.
        </p>
      </header>

      {!canWrite ? (
        <p className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-[13px] text-yellow-300">
          You can view the controls but need the <code>emergency.control</code> permission to change them.
        </p>
      ) : null}
      {msg ? <p className="rounded-md border border-signal-bear/40 bg-signal-bear/10 px-3 py-2 text-[13px] text-signal-bear">{msg}</p> : null}
      {q.isError ? <p className="text-[13px] text-signal-bear">Failed to load controls — the store may be unreachable.</p> : null}

      {canWrite ? (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for the change (recommended — logged with the action)"
          className="w-full rounded-md border border-border-subtle bg-bg-base px-2.5 py-1.5 text-[13px]"
        />
      ) : null}

      {c ? (
        <>
          <section className="rounded-md border border-border-subtle bg-bg-raised">
            <div className="border-b border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              Global kill switches
            </div>
            {FEATURES.map(([key, label]) => (
              <Row key={key} label={label} enabled={c[key]} onToggle={(next) => patch({ [key]: next })} />
            ))}
          </section>

          <section className="rounded-md border border-border-subtle bg-bg-raised">
            <div className="border-b border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              Per-chain trading
            </div>
            {CHAINS.map(([key, label]) => (
              <Row
                key={key}
                label={label}
                enabled={c.chains[key]}
                onToggle={(next) => patch({ chains: { [key]: next } })}
              />
            ))}
          </section>

          <section className="rounded-md border border-border-subtle bg-bg-raised">
            <div className="border-b border-border-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              Modes
            </div>
            <Row
              label="Maintenance mode (block all writes/money/AI; reads stay up)"
              enabled={c.maintenance}
              activeIsBad
              enabledLabel="Live"
              disabledLabel="Maintenance"
              onToggle={(next) => patch({ maintenance: next })}
            />
            <Row
              label="Read-only mode (block mutations)"
              enabled={c.readOnly}
              activeIsBad
              enabledLabel="Writable"
              disabledLabel="Read-only"
              onToggle={(next) => patch({ readOnly: next })}
            />
          </section>

          <section className="rounded-md border border-border-subtle bg-bg-raised p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Emergency banner</div>
            {c.banner ? (
              <p className="mt-2 text-[12px] text-fg-secondary">
                Live ({c.banner.level}): <span className="text-fg-primary">{c.banner.message}</span>
              </p>
            ) : (
              <p className="mt-2 text-[12px] text-fg-muted">No banner set.</p>
            )}
            {canWrite ? (
              <div className="mt-3 space-y-2">
                <input
                  value={bannerMsg}
                  onChange={(e) => setBannerMsg(e.target.value)}
                  placeholder="Banner message shown to all users"
                  className="w-full rounded-md border border-border-subtle bg-bg-base px-2.5 py-1.5 text-[13px]"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={bannerLevel}
                    onChange={(e) => setBannerLevel(e.target.value as 'info' | 'warn' | 'critical')}
                    className="rounded-md border border-border-subtle bg-bg-base px-2 py-1.5 text-[13px]"
                  >
                    <option value="info">info</option>
                    <option value="warn">warn</option>
                    <option value="critical">critical</option>
                  </select>
                  <button
                    type="button"
                    disabled={busy || !bannerMsg.trim()}
                    onClick={() => patch({ banner: { message: bannerMsg.trim(), level: bannerLevel } })}
                    className="rounded-md bg-accent-primary px-3 py-1.5 text-[13px] font-semibold text-fg-inverse disabled:opacity-40"
                  >
                    Set banner
                  </button>
                  <button
                    type="button"
                    disabled={busy || !c.banner}
                    onClick={() => patch({ banner: null })}
                    className="rounded-md border border-border-subtle px-3 py-1.5 text-[13px] text-fg-secondary disabled:opacity-40"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          <p className="text-[11px] text-fg-muted">
            Last change: {c.updatedBy ?? '—'} · {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '—'}
          </p>
        </>
      ) : (
        <p className="text-sm text-fg-muted">Loading controls…</p>
      )}
    </div>
  );
}
