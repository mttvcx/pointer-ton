'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, MessageSquare, Pin } from 'lucide-react';
import { toast } from 'sonner';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import type { ChainFocus, SquadSummary } from '@/lib/squads/types';
import { DEMO_ROOM_ACTIVITIES, DEMO_SQUADS } from '@/lib/squads/demo';
import { ChainIcon } from '@/components/squads/ChainIcon';
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
      <div className="rounded-lg border border-border-subtle bg-bg-raised p-4 text-xs text-fg-muted">
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Active squads', value: String(roomRows.length) },
            { label: 'Unread updates', value: String(summary.unread) },
            { label: 'Open votes', value: String(summary.votes) },
            { label: 'Shared alerts', value: String(summary.alerts) },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border-subtle bg-bg-raised p-3 transition-colors hover:border-border">
              <p className="text-[10px] uppercase tracking-[0.16em] text-fg-muted">{s.label}</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-fg-primary">{s.value}</p>
            </div>
          ))}
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
        <SquadPanel padding="p-3" tone="premium" className="border border-border-subtle">
          <h3 className="flex items-center gap-2 text-[12px] font-semibold text-fg-primary">
            <Bell className="h-3.5 w-3.5 text-accent-ethos" strokeWidth={2.2} />
            Recent activity
          </h3>
          <ul className="mt-3 divide-y divide-border-subtle/50">
            {DEMO_ROOM_ACTIVITIES.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-start gap-2 border-b border-border-subtle/50 py-2 last:border-0 last:pb-0">
                <span className="mt-0.5 w-10 shrink-0 tabular-nums text-[10px] text-fg-muted">{a.ago}</span>
                <span className="text-xs leading-relaxed text-fg-secondary">{a.text}</span>
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

const MEMBER_RING: Record<string, string[]> = {
  'archon-desk': ['CR', 'HE', 'VO'],
  'perimeter-hl': ['HE', 'VO', 'CR'],
  'ton-signal': ['VO', 'HE', 'CR'],
};

function roomBannerClass(badge: string): string {
  const b = badge.toLowerCase();
  if (b.includes('invite')) return 'bg-fg-muted/15 text-fg-secondary';
  if (b.includes('public')) return 'bg-signal-info/10 text-signal-info';
  if (b.includes('verified')) return 'bg-accent-ethos/10 text-accent-ethos';
  return 'bg-accent-ethos/10 text-accent-ethos';
}

function roomBannerText(badge: string): string {
  const b = badge.toLowerCase();
  if (b.includes('invite')) return 'INVITE ONLY';
  if (b.includes('public')) return 'PUBLIC ROOM';
  if (b.includes('verified')) return 'VERIFIED ACCESS';
  return 'LIVE';
}

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
  const digestLines = feedLine.split(' · ').map((x) => x.trim()).filter(Boolean);

  return (
    <article
      className={cn(
        'overflow-hidden rounded-lg border border-border-subtle bg-bg-raised transition-colors hover:border-border',
        squadCardHoverInteractiveClass,
      )}
    >
      <div
        className={cn(
          'flex items-center gap-1.5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em]',
          roomBannerClass(room.badge),
        )}
      >
        {roomBannerText(room.badge)}
      </div>

      <div className="relative p-4 pt-3">
        <div className="flex flex-wrap gap-4">
          <div className="flex min-w-0 flex-1 gap-3">
            <div className="relative shrink-0">
              <div className="absolute -left-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-bg-raised bg-signal-bull" />
              <SquadMonogram
                size="lg"
                className="border border-border-subtle bg-bg-sunken text-sm font-bold text-fg-secondary"
              >
                {room.monogram}
              </SquadMonogram>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold tracking-tight text-fg-primary">{room.name}</h3>
              <p className="mt-1 max-w-[62ch] text-xs leading-snug text-fg-muted">{room.shortDescription}</p>

              <div className="mt-3 space-y-1 rounded-md bg-bg-sunken p-2.5 text-xs">
                {digestLines.map((line, i) => (
                  <div key={`${room.slug}-digest-${i}`} className="flex gap-1.5 leading-snug text-fg-secondary">
                    <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-muted" strokeWidth={2} />
                    <span>{line}</span>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {room.chains.map((ch) => (
                  <span
                    key={ch}
                    className="flex h-5 w-5 items-center justify-center rounded bg-bg-sunken"
                    title={chainLabel(ch)}
                  >
                    {ch === 'multi' ? (
                      <span className="text-[9px] font-semibold text-fg-muted">+</span>
                    ) : (
                      <ChainIcon chain={ch} size={11} />
                    )}
                  </span>
                ))}
              </div>
              <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
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
                    <dd className="font-semibold tabular-nums text-accent-ethos">{s.openSeatsCount}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>

          <div className="ml-auto flex shrink-0 flex-col items-end gap-2">
            <div className="flex -space-x-1.5">
              {stack.slice(0, 3).map((m, i) => (
                <div
                  key={`${m}-${i}`}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full bg-bg-sunken text-[9px] font-bold text-fg-secondary ring-2 ring-bg-raised',
                    i === 2 && 'opacity-95',
                  )}
                  title="Member"
                >
                  {m}
                </div>
              ))}
              <div className="flex h-6 min-w-6 items-center justify-center rounded-full bg-bg-sunken px-1 text-[9px] font-semibold tabular-nums text-fg-muted ring-2 ring-bg-raised">
                +{Math.max(0, room.members - 3)}
              </div>
            </div>
            <span className="text-[10px] font-medium text-fg-muted">{room.members} members</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border-subtle/50 pt-4">
          <Link
            href={`/squads/room/${room.slug}`}
            className="inline-flex h-9 min-w-[140px] flex-1 items-center justify-center rounded-md bg-accent-ethos text-sm font-semibold text-bg-base transition-colors hover:bg-accent-ethos-soft"
          >
            Enter room
          </Link>
          <button
            type="button"
            className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-bg-sunken px-3 text-sm font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary"
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
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-bg-sunken px-3 text-sm font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary"
            onClick={() =>
              toast.message('Notifications', {
                description: `Mute alerts or votes independently for ${room.name}.`,
              })
            }
          >
            <Bell className="h-3.5 w-3.5" strokeWidth={2} />
            Notifications
          </button>
        </div>
      </div>
    </article>
  );
}
