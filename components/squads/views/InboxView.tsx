'use client';

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Eye,
  Globe,
  Lock,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import type { DemoRichInvite, DemoRichRequest } from '@/lib/squads/demo';
import { DEMO_INVITE_PRIMARY, DEMO_REQUESTS_ROWS } from '@/lib/squads/demo';
import { ChainIcon, hasChainLogo } from '@/components/squads/ChainIcon';
import { SquadGlassModal } from '@/components/squads/SquadGlassModal';
import { SquadPanel } from '@/components/squads/squadsPrimitives';
import { cn } from '@/lib/utils/cn';

export function InboxView() {
  const [inviteFilter, setInviteFilter] = useState('all');
  const [requestFilter, setRequestFilter] = useState('all');
  const [invite, setInvite] = useState<DemoRichInvite | null>(DEMO_INVITE_PRIMARY);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [requests, setRequests] = useState<DemoRichRequest[]>(DEMO_REQUESTS_ROWS);

  const outgoing = useMemo(() => requests.filter((r) => r.kind === 'outgoing'), [requests]);
  const incoming = useMemo(() => requests.filter((r) => r.kind === 'incoming'), [requests]);

  return (
    <div className="grid min-h-0 gap-5 lg:grid-cols-2">
      <section className="space-y-3">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold text-fg-primary">Invites</h2>
              {invite ? (
                <span className="rounded border border-[#2c3545] px-1.5 py-px text-[10px] font-medium tabular-nums text-fg-muted">
                  1
                </span>
              ) : (
                <span className="rounded border border-[#2c3545] px-1.5 py-px text-[10px] font-medium tabular-nums text-fg-muted">
                  0
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-fg-muted">Squad rooms you&apos;ve been invited to.</p>
          </div>
          <InviteFilterDropdown value={inviteFilter} onChange={setInviteFilter} />
        </header>

        {invite ? (
          <article className="space-y-4 rounded-lg border border-border-subtle bg-bg-raised p-4 transition-colors hover:border-border">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
              <span className="flex h-5 items-center gap-1 rounded bg-bg-sunken px-1.5 text-[10px] font-medium uppercase tracking-wide text-fg-muted">
                {invite.roomType.toLowerCase().includes('private') ? (
                  <>
                    <Lock className="h-2.5 w-2.5" strokeWidth={2.4} />
                    Private
                  </>
                ) : (
                  <>
                    <Globe className="h-2.5 w-2.5" strokeWidth={2.4} />
                    Public
                  </>
                )}
              </span>
              <h3 className="min-w-0 text-base font-bold tracking-tight text-fg-primary">{invite.squadName}</h3>
            </div>
            <p className="max-w-[62ch] text-xs leading-relaxed text-fg-secondary">{invite.pitch}</p>

            <div className="flex flex-wrap gap-1.5">
              {(invite.squadTags ?? ['Hyperliquid', 'Desk']).map((tag) =>
                hasChainLogo(tag) ? (
                  <span
                    key={tag}
                    className="flex h-6 w-6 items-center justify-center rounded bg-bg-sunken"
                    title={tag}
                  >
                    <ChainIcon chain={tag} size={12} />
                  </span>
                ) : (
                  <span
                    key={tag}
                    className="h-5 rounded px-1.5 text-[10px] font-medium leading-5 bg-bg-sunken text-fg-muted"
                  >
                    {tag}
                  </span>
                ),
              )}
            </div>

            <div className="rounded-md bg-bg-sunken p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-bg-raised text-[10px] font-bold text-fg-secondary">
                  {invite.senderMonogram ?? 'OP'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fg-primary">@{invite.fromHandle}</p>
                  <p className="text-xs text-fg-muted">
                    {invite.senderRole ?? 'Room operator'} · sent {invite.ago}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-signal-warn/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-signal-warn">
                  <Clock className="h-3 w-3" strokeWidth={2} />
                  {invite.expiresInLabel ?? '7d window'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-border-subtle overflow-hidden rounded border border-border-subtle sm:grid-cols-4">
              <DetailItem label="Room type" value={invite.roomType} />
              <DetailItem label="Access" value={invite.access} />
              <DetailItem label="Trust" value={invite.trustRequirement} />
              <DetailItem label="Capacity" value={`${invite.membersCurrent} / ${invite.membersCap}`} />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent-ethos py-2.5 text-sm font-semibold text-bg-base transition-colors hover:bg-accent-ethos-soft"
                onClick={() => {
                  toast.success('Invite accepted', { description: `You joined ${invite.squadName}.` });
                  setPreviewOpen(false);
                  setInvite(null);
                }}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                Accept
              </button>
              <button
                type="button"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-bg-sunken px-3 py-2.5 text-sm font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="h-3.5 w-3.5" strokeWidth={2.2} />
                Preview
              </button>
              <button
                type="button"
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-bg-sunken py-2.5 text-sm font-medium text-fg-muted transition-colors hover:bg-signal-bear/10 hover:text-signal-bear"
                onClick={() => {
                  toast.message('Invite declined');
                  setPreviewOpen(false);
                  setInvite(null);
                }}
              >
                Decline
              </button>
            </div>
            <p className="text-[10px] text-fg-muted">Invites expire in 7 days.</p>
          </article>
        ) : (
          <SquadPanel tone="inset" className="flex flex-col items-center py-14 text-center">
            <Check className="h-8 w-8 text-emerald-500/70" strokeWidth={1.75} aria-hidden />
            <p className="mt-3 text-[13px] font-semibold text-fg-primary">Inbox zero</p>
            <p className="mt-1 max-w-[36ch] text-[12px] text-fg-muted">
              Pending squad invites surface here — check recruit for rooms you&apos;re actively pursuing.
            </p>
          </SquadPanel>
        )}
      </section>

      <section className="space-y-3">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold text-fg-primary">Requests</h2>
              <span className="rounded border border-[#2c3545] px-1.5 py-px text-[10px] font-medium tabular-nums text-fg-muted">
                {requests.length}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-fg-muted">Your room requests and applications.</p>
          </div>
          <RequestFilterDropdown value={requestFilter} onChange={setRequestFilter} />
        </header>

        <SquadPanel tone="premium" className="space-y-5 border border-border-subtle">
          <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-muted">Outbound</span>
            <span className="rounded border border-[#2f3f52] bg-black/40 px-1.5 text-[10px] font-medium tabular-nums text-fg-secondary">
              {outgoing.length}
            </span>
          </div>
          {outgoing.length === 0 ? (
            <p className="text-[11px] italic text-fg-muted">Nothing queued — submissions you send show here.</p>
          ) : (
            <ul className="space-y-2">
              {outgoing.map((r) => (
                <RequestRow key={r.id} r={r} />
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2 pt-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-fg-muted">Inbound</span>
            <span className="rounded border border-[#2f3f52] bg-black/40 px-1.5 text-[10px] font-medium tabular-nums text-fg-secondary">
              {incoming.length}
            </span>
          </div>
          {incoming.length === 0 ? (
            <p className="text-[11px] italic text-fg-muted">
              Incoming join requests arrive here for moderation.
            </p>
          ) : (
            <ul className="space-y-2">
              {incoming.map((r) => (
                <RequestRow key={r.id} r={r} />
              ))}
            </ul>
          )}
        </SquadPanel>

        <button
          type="button"
          className="flex w-full items-center justify-center gap-1 text-xs font-medium text-accent-ethos transition hover:text-accent-glow"
          onClick={() =>
            toast.message('Activity timeline', {
              description: 'Your full Squads inbox history opens from this shortcut.',
            })
          }
        >
          View all activity
          <ArrowRight className="h-3 w-3" strokeWidth={2.2} />
        </button>
      </section>

      <SquadGlassModal open={previewOpen} title="Room preview" onClose={() => setPreviewOpen(false)}>
        {invite ? (
          <div className="space-y-3 text-[12px]">
            <p className="text-fg-secondary">{invite.pitch}</p>
            <p className="text-fg-muted">
              Operators coordinate live around shared watchlists, votes, and execution context —{' '}
              <span className="text-fg-secondary">not chat-first.</span>
            </p>
            <Link
              href={`/squads/room/${invite.squadSlug}`}
              className="flex w-full items-center justify-center rounded-lg bg-accent-ethos py-2.5 text-[11px] font-semibold text-bg-base transition hover:bg-accent-ethos-soft"
              onClick={() => setPreviewOpen(false)}
            >
              Enter room
            </Link>
          </div>
        ) : null}
      </SquadGlassModal>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col bg-bg-raised px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-fg-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-fg-primary">{value}</p>
    </div>
  );
}

function RequestStatus({ status }: { status: DemoRichRequest['status'] }) {
  const cls =
    status === 'pending'
      ? 'bg-signal-warn/15 text-signal-warn'
      : status === 'awaiting_review'
        ? 'bg-accent-primary/15 text-accent-primary'
        : 'bg-signal-bull/15 text-signal-bull';
  const label =
    status === 'pending' ? 'Pending' : status === 'awaiting_review' ? 'Awaiting review' : 'Approved';
  return (
    <span className={cn('rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide', cls)}>
      {label}
    </span>
  );
}

function RequestRow({ r }: { r: DemoRichRequest }) {
  return (
    <li className="flex flex-wrap items-start gap-3 rounded-lg border border-[#303848]/93 bg-black/52 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-black/20">
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded text-[11px] font-bold ring-1',
          r.kind === 'outgoing'
            ? 'bg-[#12202c] text-[#7ebef2] ring-[#234a62]'
            : 'bg-[#171328] text-[#c4b5fd] ring-[#45306b]',
        )}
      >
        {r.monogram}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-fg-primary">{r.squadName}</span>
          <RequestStatus status={r.status} />
        </div>
        <p className="mt-0.5 text-[11px] text-fg-muted">
          {r.kind === 'outgoing' ? 'Applied' : 'Requested'} {r.ago}
          {r.actorHandle ? ` · @${r.actorHandle}` : ''}
        </p>
        {r.message ? (
          <p className="mt-2 border-l-2 border-[#2a4558] pl-2 text-[11.5px] text-fg-secondary">
            {r.message}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="rounded p-1.5 text-fg-muted hover:bg-white/[0.05] hover:text-fg-secondary"
        aria-label="More"
        onClick={() => toast.message('Request details', { description: r.squadName })}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
      </button>
    </li>
  );
}

function InviteFilterDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11px] text-fg-muted">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-md border border-[#252b36] bg-[#0a0e14] py-1.5 pr-7 pl-2 text-[11px] font-semibold text-fg-primary outline-none focus:border-[#2a9bc8]/55"
      >
        <option value="all">All invites</option>
      </select>
      <ChevronDown className="pointer-events-none -ml-6 h-3.5 w-3.5 text-fg-muted" />
    </label>
  );
}

function RequestFilterDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[11px] text-fg-muted">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-md border border-[#252b36] bg-[#0a0e14] py-1.5 pr-7 pl-2 text-[11px] font-semibold text-fg-primary outline-none focus:border-[#2a9bc8]/55"
      >
        <option value="all">All requests</option>
      </select>
      <ChevronDown className="pointer-events-none -ml-6 h-3.5 w-3.5 text-fg-muted" />
    </label>
  );
}
