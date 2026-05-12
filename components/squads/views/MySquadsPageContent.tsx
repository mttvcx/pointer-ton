'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Pin } from 'lucide-react';
import { toast } from 'sonner';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import type { ChainFocus, SquadSummary } from '@/lib/squads/types';
import { DEMO_ROOM_ACTIVITIES, DEMO_SQUADS } from '@/lib/squads/demo';
import {
  SquadMonogram,
  SquadPanel,
  squadCardHoverInteractiveClass,
} from '@/components/squads/squadsPrimitives';
import { cn } from '@/lib/utils/cn';

type ListResponse = {
  squads: SquadSummary[];
  provisioned: boolean;
};

export function MySquadsPageContent() {
  const { getAccessToken, authenticated } = usePointerAuth();

  const squadsQ = useQuery<ListResponse>({
    queryKey: ['squads-my'],
    enabled: authenticated,
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/squads/list', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('list_failed');
      return (await res.json()) as ListResponse;
    },
    staleTime: 30_000,
  });

  const liveSquads = squadsQ.data?.squads ?? [];
  const liveMerged = useMemo(() => {
    if (!squadsQ.data?.provisioned || liveSquads.length === 0) return null;
    return liveSquads.map((s) => ({
      slug: s.slug,
      name: s.name,
      description: s.description || '—',
      chains: s.chainFocus,
      trustMode: `${s.visibility.replace(/_/g, ' ')}`,
      members: s.memberCount,
      recentActivityCount: 12,
      monogram: s.name
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    }));
  }, [squadsQ.data?.provisioned, liveSquads]);

  if (squadsQ.isLoading) {
    return (
      <div className="rounded-lg border border-[#1b2129] bg-[#0d1117]/95 p-4 text-[12px] text-fg-muted">
        Loading your squads…
      </div>
    );
  }

  const roomRows: RoomCardModel[] = liveMerged?.length
    ? liveMerged.map((r) => ({
        slug: r.slug,
        name: r.name,
        monogram: r.monogram,
        shortDescription: r.description,
        chains: r.chains,
        trustMode: r.trustMode,
        members: r.members,
        recentActivityCount: r.recentActivityCount,
        badge: 'Live',
      }))
    : DEMO_SQUADS.map((s) => ({
        slug: s.slug,
        name: s.name,
        monogram: s.monogram,
        shortDescription: s.shortDescription,
        chains: s.chains,
        trustMode: s.trustMode,
        members: s.members,
        recentActivityCount: s.recentActivityCount,
        badge:
          s.visibility === 'invite_only'
            ? 'Invite only'
            : s.visibility === 'public'
              ? 'Public room'
              : 'Verified access',
      }));

  const summary = useMemo(() => {
    let unread = 0;
    let votes = 0;
    let alerts = 0;
    for (const s of DEMO_SQUADS) {
      unread += Math.min(9, Math.max(3, Math.round(s.recentActivityCount * 0.12)));
      votes += s.signalGrade === 'high' ? 1 : 0;
      alerts += s.recentActivityCount > 20 ? 4 : 2;
    }
    return { unread, votes, alerts };
  }, []);

  return (
    <div className="grid min-h-0 gap-5 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <SummaryPill label="Active squads" value={String(roomRows.length)} />
          <SummaryPill label="Unread updates" value={String(summary.unread)} />
          <SummaryPill label="Open votes" value={String(summary.votes)} />
          <SummaryPill label="Shared alerts" value={String(summary.alerts)} />
        </div>

        <ul className="flex flex-col gap-2">
          {roomRows.map((room) => (
            <li key={room.slug}>
              <RoomCard room={room} />
            </li>
          ))}
        </ul>

        {liveMerged && liveMerged.length === 0 ? (
          <p className="text-[12px] text-fg-muted">
            No synced memberships yet — rooms below stay available for navigation and review.
          </p>
        ) : null}
      </div>

      <aside className="space-y-3 lg:sticky lg:top-[calc(var(--app-header-offset,0px)+8px)] lg:self-start">
        <SquadPanel padding="p-3" tone="premium" className="ring-1 ring-[#374b63]/35">
          <h3 className="flex items-center gap-2 text-[12px] font-semibold text-fg-primary">
            <Bell className="h-3.5 w-3.5 text-[#6aa7e6]" strokeWidth={2.2} />
            Recent activity
          </h3>
          <ul className="mt-3 space-y-2.5">
            {DEMO_ROOM_ACTIVITIES.slice(0, 5).map((a, i) => (
              <li
                key={a.id}
                className={cn(
                  'flex gap-3 border-l-2 py-1 pl-2.5 text-[11px]',
                  i === 0 ? 'border-l-[#3b82c8]' : 'border-l-transparent opacity-92',
                )}
              >
                <span className="w-14 shrink-0 text-[10px] font-medium tabular-nums text-fg-muted">{a.ago}</span>
                <span className="leading-snug text-fg-secondary">{a.text}</span>
              </li>
            ))}
          </ul>
        </SquadPanel>

        <SquadPanel padding="p-3" tone="inset">
          <h3 className="flex items-center gap-2 text-[12px] font-semibold text-fg-primary">
            <Pin className="h-3.5 w-3.5 text-[#a7b8cc]" strokeWidth={2.2} />
            Pinned rooms
          </h3>
          <p className="mt-2 text-[11px] leading-relaxed text-fg-muted">
            Pin high-signal rooms so alerts and votes stay visible above noise.
          </p>
          <button
            type="button"
            className="mt-3 w-full rounded-lg border border-[#3d556f]/85 bg-[#121a2666] py-2.5 text-[11px] font-semibold text-fg-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:border-[#627fa3] hover:text-fg-primary"
            onClick={() =>
              toast.message('Pin a room', {
                description: 'Choose a room after you join — pinning saves to your layout.',
              })
            }
          >
            Pin a room
          </button>
        </SquadPanel>
      </aside>
    </div>
  );
}

type RoomCardModel = {
  slug: string;
  name: string;
  monogram: string;
  shortDescription: string;
  chains: ChainFocus[];
  trustMode: string;
  members: number;
  recentActivityCount: number;
  badge: string;
};

const ROOM_FEED_PREVIEW: Record<string, string> = {
  'archon-desk': 'Open vote · checklist extension · 18m',
  'perimeter-hl': 'HL basis thread · active now',
  'ton-signal': 'Pinned liquidity read · refreshed 42m ago',
};

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-[112px] flex-1 flex-col rounded-xl border border-[#35506c]/55 bg-gradient-to-b from-[#152232]/95 to-[#080c12] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-black/25">
      <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-fg-muted">{label}</span>
      <span className="mt-1 text-[17px] font-semibold tabular-nums leading-tight tracking-tight text-fg-primary">
        {value}
      </span>
    </div>
  );
}

const MEMBER_RING: Record<string, string[]> = {
  'archon-desk': ['CR', 'HE', 'VO'],
  'perimeter-hl': ['HE', 'VO', 'CR'],
  'ton-signal': ['VO', 'HE', 'CR'],
};

function chainLabel(c: ChainFocus): string {
  switch (c) {
    case 'sol':
      return 'Solana';
    case 'ton':
      return 'TON';
    case 'base':
      return 'Base';
    case 'hyperliquid':
      return 'Hyperliquid';
    case 'bnb':
      return 'BNB';
    case 'multi':
      return 'Multi-chain';
    default:
      return c;
  }
}

function RoomCard({ room }: { room: RoomCardModel }) {
  const s = DEMO_SQUADS.find((x) => x.slug === room.slug);
  const feedLine = ROOM_FEED_PREVIEW[room.slug] ?? DEMO_ROOM_ACTIVITIES[0]?.text ?? 'Room digest updating';
  const stack = MEMBER_RING[room.slug] ?? ['OP', 'Q1', 'Q2'];

  return (
    <SquadPanel
      tone="premium"
      className={cn('relative overflow-hidden', squadCardHoverInteractiveClass)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 top-0 h-32 w-32 rounded-full bg-[#2e5f8f]/16 blur-[48px]"
      />
      <div className="relative flex flex-wrap gap-4">
        <div className="flex gap-3">
          <div className="relative">
            <div className="absolute -left-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-[#0d1117] bg-[#4ade80]" />
            <SquadMonogram
              size="lg"
              className="border border-[#3a4b5f] bg-[#111820] text-[14px] font-bold"
            >
              {room.monogram}
            </SquadMonogram>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold tracking-tight text-fg-primary">{room.name}</h3>
              <span className="rounded border border-[#2f4a62]/65 bg-[#1a2836]/85 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-[#7ebef2] ring-1 ring-inset ring-white/[0.04]">
                {room.badge}
              </span>
            </div>
            <p className="mt-1 max-w-[62ch] text-[11.5px] leading-snug text-fg-muted">{room.shortDescription}</p>

            <div className="mt-2 rounded-lg border border-[#2f3c4d]/85 bg-black/42 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-fg-muted">Latest in room</p>
              <p className="mt-0.5 text-[11px] leading-snug text-[#cdd9e9]">{feedLine}</p>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {room.chains.map((ch) => (
                <span
                  key={ch}
                  className="rounded border border-[#334555] bg-black/38 px-1.5 py-px text-[10px] text-fg-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                >
                  {chainLabel(ch)}
                </span>
              ))}
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px]">
              <div className="flex gap-1.5">
                <dt className="text-fg-muted">Trust</dt>
                <dd className="font-medium text-fg-secondary">{room.trustMode}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-fg-muted">Updates</dt>
                <dd className="font-semibold tabular-nums text-fg-primary">{room.recentActivityCount}</dd>
              </div>
              {s ? (
                <div className="flex gap-1.5">
                  <dt className="text-fg-muted">Open seats</dt>
                  <dd className="font-semibold tabular-nums text-[#fde68a]">{s.openSeatsCount}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>

        <div className="ml-auto flex flex-col items-end gap-2">
          <div className="flex -space-x-2.5">
            {stack.slice(0, 3).map((m, i) => (
              <div
                key={`${m}-${i}`}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#0d1117] bg-gradient-to-br from-[#1c283d] to-[#101827] text-[10px] font-bold text-[#e2ecfa]',
                  i === 2 && 'opacity-95',
                )}
                title="Member"
              >
                {m}
              </div>
            ))}
            <div className="flex h-9 min-w-9 items-center justify-center rounded-full border-2 border-[#0d1117] bg-[#151c26] px-1.5 text-[10px] font-semibold tabular-nums text-fg-muted">
              +{Math.max(0, room.members - 3)}
            </div>
          </div>
          <span className="text-[10px] font-medium text-fg-muted">{room.members} members</span>
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
        <Link
          href={`/squads/room/${room.slug}`}
          className="inline-flex min-h-[38px] flex-[1_1_160px] items-center justify-center rounded-lg bg-[#1f7ab8] px-4 py-2.5 text-[11.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-[#268fcc]"
        >
          Enter room
        </Link>
        <button
          type="button"
          className="inline-flex min-h-[38px] flex-1 items-center justify-center rounded-lg border border-[#405a77]/85 bg-[#121a24]/90 px-3 py-2.5 text-[11px] font-semibold text-fg-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-[#5f7eab] hover:bg-[#171f2b]"
          onClick={() =>
            toast.message('Activity', {
              description: `Alerts and votes for ${room.name} appear in-room.`,
            })
          }
        >
          View activity
        </button>
        <button
          type="button"
          className="inline-flex min-h-[38px] flex-1 items-center justify-center rounded-lg border border-dashed border-[#394b60] bg-black/30 px-3 py-2.5 text-[11px] font-semibold text-[#8eb6d9] hover:border-[#5b7694] hover:text-[#bde3ff]"
          onClick={() =>
            toast.message('Notifications', {
              description: `Mute alerts or votes independently for ${room.name}.`,
            })
          }
        >
          Notifications
        </button>
      </div>
    </SquadPanel>
  );
}
