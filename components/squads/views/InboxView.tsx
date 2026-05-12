'use client';

import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock,
  Eye,
  Lock,
  MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import type { DemoRichInvite, DemoRichRequest } from '@/lib/squads/demo';
import { DEMO_INVITE_PRIMARY, DEMO_REQUESTS_ROWS } from '@/lib/squads/demo';
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
          <SquadPanel
            tone="premium"
            className="relative overflow-hidden space-y-4 ring-1 ring-[#3b5a78]/30"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_0%_0%,rgba(55,120,190,0.14),transparent_55%)]"
            />
            <div className="relative h-0.5 rounded-full bg-gradient-to-r from-[#3f7ab8]/88 via-transparent to-transparent" />
            <div className="relative flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                <div
                  className={cn(
                    'flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg border border-emerald-800/52 bg-emerald-950/22 text-[14px] font-bold text-emerald-200 ring-2 ring-black/35',
                  )}
                >
                  {invite.monogram}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold tracking-tight text-fg-primary">
                      {invite.squadName}
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded border border-[#4f5f72]/74 bg-black/43 px-1.5 py-px text-[9px] font-bold uppercase text-fg-muted">
                      <Lock className="h-2.5 w-2.5" strokeWidth={2.4} />
                      Private
                    </span>
                  </div>
                  <p className="mt-2 max-w-[60ch] text-[12px] leading-relaxed text-fg-secondary">{invite.pitch}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(invite.squadTags ?? ['Hyperliquid', 'Desk']).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-[#3d4f64] bg-black/35 px-1.5 py-px text-[10px] font-medium text-[#b8cae4]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="relative rounded-xl border border-[#33475e]/92 bg-black/52 p-3 shadow-inner">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-fg-muted">From</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-sky-900/61 bg-[#102535] text-[12px] font-bold text-[#7ebef2] ring-2 ring-black/55">
                  {invite.senderMonogram ?? 'OP'}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-fg-primary">@{invite.fromHandle}</p>
                  <p className="text-[11px] text-fg-muted">
                    {invite.senderRole ?? 'Room operator'} · sent {invite.ago}
                  </p>
                </div>
                <span className="ml-auto inline-flex items-center gap-1 rounded border border-orange-950/71 bg-orange-950/24 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-100">
                  <Clock className="h-3 w-3" strokeWidth={2} />
                  {invite.expiresInLabel ?? '7d window'}
                </span>
              </div>
            </div>

            <dl className="relative grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
              <DetailItem label="Room type" value={invite.roomType} accent />
              <DetailItem label="Access" value={invite.access} />
              <DetailItem label="Trust" value={invite.trustRequirement} />
              <DetailItem label="Capacity" value={`${invite.membersCurrent} / ${invite.membersCap}`} />
            </dl>

            <div className="relative flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#1f7ab8] py-3 text-[11.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-[#268fcc]"
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
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#4f6c8c]/75 bg-[#15202e]/95 py-3 text-[11px] font-semibold text-fg-primary hover:border-[#6c92bb] hover:bg-[#182433]"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="h-3.5 w-3.5" strokeWidth={2.2} />
                Preview
              </button>
              <button
                type="button"
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-[#5c3030]/75 bg-black/56 py-3 text-[11px] font-semibold text-[#fca5a5] hover:border-[#7f4747]"
                onClick={() => {
                  toast.message('Invite declined');
                  setPreviewOpen(false);
                  setInvite(null);
                }}
              >
                Decline
              </button>
            </div>
            <p className="relative text-[10px] text-fg-muted">Invites expire in 7 days.</p>
          </SquadPanel>
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

        <SquadPanel tone="premium" className="space-y-5 ring-1 ring-[#354b63]/32">
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
          className="flex w-full items-center justify-center gap-1.5 text-[11px] font-semibold text-[#67bffd] hover:underline"
          onClick={() =>
            toast.message('Activity timeline', {
              description: 'Your full Squads inbox history opens from this shortcut.',
            })
          }
        >
          View all activity
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.2} />
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
              className="flex w-full items-center justify-center rounded-md bg-[#1f6daa] py-2.5 text-[11px] font-semibold text-white hover:bg-[#287fc4]"
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

function DetailItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[#303948]/93 bg-black/52 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        accent && 'border-sky-900/74 ring-1 ring-sky-900/42',
      )}
    >
      <p className="text-[9px] font-bold uppercase tracking-wide text-fg-muted">{label}</p>
      <p className="mt-0.5 text-[11px] font-medium text-fg-primary">{value}</p>
    </div>
  );
}

function RequestStatus({ status }: { status: DemoRichRequest['status'] }) {
  const cls =
    status === 'pending'
      ? 'border-[#7c3aed]/40 text-[#c4b5fd] bg-[#7c3aed]/12'
      : status === 'awaiting_review'
        ? 'border-[#2a9bc8]/45 text-[#7ebef2] bg-[#1f6daa]/15'
        : 'border-[#6ee7b7]/35 text-[#6ee7b7] bg-[#6ee7b7]/12';
  const label =
    status === 'pending' ? 'Pending' : status === 'awaiting_review' ? 'Awaiting review' : 'Approved';
  return (
    <span className={cn('rounded border px-1.5 py-px text-[9px] font-bold uppercase tracking-wide', cls)}>
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
