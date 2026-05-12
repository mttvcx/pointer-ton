'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ExternalLink, Loader2, Shield, Sparkles, UserPlus, X } from 'lucide-react';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { EthosBadge } from '@/components/squads/EthosBadge';
import { cn } from '@/lib/utils/cn';
import type { TraderDrawerOpen } from '@/store/squadsUiStore';
import type { DemoTrader } from '@/lib/squads/demo';
import { operatorSignalLabel } from '@/components/squads/operatorSignalChip';

type LivePayload = {
  trader: { id: string; displayName: string | null; createdAt: string };
  identity: Record<string, unknown>;
  ethos: import('@/lib/ethos/types').EthosProfileSnapshot | null;
  operatorSignal: import('@/lib/squads/operatorSignal').OperatorSignal;
};

export function TraderProfileDrawer({
  open,
  payload,
  onClose,
}: {
  open: boolean;
  payload: TraderDrawerOpen | null;
  onClose: () => void;
}) {
  const { getAccessToken } = usePointerAuth();
  const { mounted, visible } = useOverlayPresence(open && Boolean(payload));

  const liveId = payload?.mode === 'live' ? payload.userId : null;

  const liveQ = useQuery({
    queryKey: ['squads-trader', liveId],
    enabled: Boolean(open && liveId),
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(`/api/squads/trader/${liveId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('trader_fetch');
      return (await res.json()) as LivePayload;
    },
  });

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted || !payload) return null;

  const demo = payload.mode === 'demo' ? payload.trader : null;

  return (
    <div className="fixed inset-0 z-[540] flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className={cn(
          'absolute inset-0 bg-[rgba(3,5,10,0.58)] backdrop-blur-md',
          overlayBackdropClasses(visible),
          'fill-mode-forwards',
        )}
        aria-label="Close profile"
        onClick={onClose}
      />
      <aside
        className={cn(
          'relative flex h-full w-full max-w-md flex-col border-l border-white/[0.08]',
          'bg-[rgba(8,13,20,0.96)] shadow-[-24px_0_64px_-24px_rgba(0,0,0,0.75)] backdrop-blur-xl',
          overlayPanelClasses(visible),
          'fill-mode-forwards',
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] p-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fg-muted">
              Operator profile
            </p>
            <h2 className="mt-1 truncate text-[16px] font-semibold text-fg-primary">
              {demo
                ? demo.displayName
                : liveQ.data?.trader.displayName ?? (liveQ.isLoading ? 'Loading…' : 'Trader')}
            </h2>
            <p className="truncate text-[11px] font-medium text-[#5ebffb]/90">
              @{demo?.handle ?? '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-fg-muted transition hover:bg-white/[0.06] hover:text-fg-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {demo ? (
            <DemoBody t={demo} />
          ) : liveQ.isLoading ? (
            <div className="flex items-center gap-2 text-[12px] text-fg-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Pulling operator composite…
            </div>
          ) : liveQ.isError ? (
            <p className="text-[12px] text-signal-warn">Could not load profile.</p>
          ) : liveQ.data ? (
            <LiveBody data={liveQ.data} />
          ) : null}

          <div className="mt-auto grid gap-2 border-t border-white/[0.06] pt-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#5EBBFF]/15 py-2 text-[11.5px] font-semibold text-[#5EBBFF] ring-1 ring-inset ring-[#5EBBFF]/35 transition hover:bg-[#5EBBFF]/25"
              >
                <UserPlus className="h-3.5 w-3.5" strokeWidth={2.2} />
                Invite to squad
              </button>
              <Link
                href="/trackers"
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-white/[0.1] py-2 text-[11.5px] font-semibold text-fg-secondary transition hover:bg-white/[0.04]"
              >
                Follow · trackers
              </Link>
            </div>
            {demo?.ethos.profileUrl ? (
              <a
                href={demo.ethos.profileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-semibold text-fg-muted hover:text-fg-secondary"
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.2} />
                Open Ethos profile
              </a>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

function DemoBody({ t }: { t: DemoTrader }) {
  return (
    <>
      <div
        className={cn(
          'rounded-lg border border-[#252b36] p-4',
          'bg-[#0f141c] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
          t.avatarTint,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-black/35 text-[13px] font-bold tracking-tight text-fg-primary">
            {t.monogram}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {t.ethosVerified ? (
                <span className="rounded border border-[#6ee7b7]/35 bg-[#6ee7b7]/12 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-[#6ee7b7]">
                  Ethos verified
                </span>
              ) : null}
              <EthosBadge profile={t.ethos} size="sm" />
            </div>
            <p className="mt-2 text-[11.5px] leading-snug text-fg-secondary">{t.shortBio}</p>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-white/[0.06] bg-[#0b1119]/80 p-3">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          <Sparkles className="h-3.5 w-3.5 text-[#5EBBFF]" strokeWidth={2.2} />
          Operator signal
        </h3>
        <p className="mt-2 text-[13px] font-semibold text-fg-primary">
          {operatorSignalLabel(t.operator.level)}
        </p>
        <ul className="mt-2 grid gap-1.5 text-[11px] text-fg-secondary">
          {t.operator.factors.map((f) => (
            <li key={f.label} className="leading-snug">
              <span className="text-fg-muted">{f.label}:</span> {f.detail}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-2 gap-2 text-[11px]">
        <Stat label="30d volume" value={`$${(t.volume30dUsd / 1e6).toFixed(2)}M`} />
        <Stat label="Mutual squads" value={String(t.mutualSquads)} />
        <Stat label="Mutual vouches" value={String(t.mutualVouches)} />
      </section>

      {t.riskFlags.length ? (
        <section className="rounded-lg border border-signal-warn/30 bg-signal-warn/10 p-3 text-[11px] text-signal-warn">
          Risk notes: {t.riskFlags.join(', ')}
        </section>
      ) : null}
    </>
  );
}

function LiveBody({ data }: { data: LivePayload }) {
  return (
    <>
      <div className="rounded-xl border border-white/[0.06] bg-[#0b1119]/80 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <EthosBadge profile={data.ethos} size="md" />
        </div>
        <p className="mt-2 text-[12px] text-fg-secondary">{data.operatorSignal.summary}</p>
        <ul className="mt-2 grid gap-1.5 text-[11px] text-fg-muted">
          {data.operatorSignal.factors.map((f) => (
            <li key={f.label}>
              <span className="font-semibold text-fg-secondary">{f.label}:</span> {f.detail}
            </li>
          ))}
        </ul>
      </div>
      <section className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-fg-muted">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#5EBBFF]" strokeWidth={2.2} />
        Privacy-respecting composite — never treat Ethos as absolute truth. Source-based only.
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-fg-muted">{label}</p>
      <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-fg-primary">{value}</p>
    </div>
  );
}
