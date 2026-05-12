'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { PhaseLockedCard } from '@/components/squads/PhaseLockedCard';
import type { SquadSummary } from '@/lib/squads/types';

type ListResponse = {
  squads: SquadSummary[];
  provisioned: boolean;
};

export function MySquadsTab() {
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

  if (squadsQ.isLoading) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-[#0b1119]/70 p-4 text-[12px] text-fg-muted">
        Loading squads…
      </div>
    );
  }

  if (!squadsQ.data?.provisioned) {
    return (
      <PhaseLockedCard
        phase="Phase 2"
        title="My Squads"
        intent="When your organization provisions rooms, they show here. Until then, use Discover traders and Recruit to find desks."
        bullets={[
          'Discover traders · filter by chain, signal, and access.',
          'Recruit · browse rooms and submit requests.',
          'Reputation · link optional identities for stronger discovery.',
        ]}
        cta={
          <Link
            href="/squads"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#5EBBFF]/15 px-3 py-1.5 text-[11.5px] font-semibold text-[#5EBBFF] ring-1 ring-inset ring-[#5EBBFF]/35 transition hover:bg-[#5EBBFF]/25"
          >
            Open Squads hub →
          </Link>
        }
      />
    );
  }

  const squads = squadsQ.data.squads;
  if (squads.length === 0) {
    return (
      <PhaseLockedCard
        phase="Phase 2"
        title="No squads yet"
        intent="Nothing joined yet—open Recruit for open desks, or wait for an invite."
        cta={
          <Link
            href="/squads/recruit"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#5EBBFF]/15 px-3 py-1.5 text-[11.5px] font-semibold text-[#5EBBFF] ring-1 ring-inset ring-[#5EBBFF]/35 transition hover:bg-[#5EBBFF]/25"
          >
            Browse recruit board →
          </Link>
        }
      />
    );
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {squads.map((s) => (
        <li key={s.id} className="rounded-lg border border-[#1f2835] bg-[#080d14] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
          <p className="text-[13px] font-semibold text-fg-primary">{s.name}</p>
          <p className="mt-1 text-[11.5px] leading-snug text-fg-muted">{s.description || '—'}</p>
          <p className="mt-2 text-[11px] tabular-nums text-fg-secondary">
            {s.memberCount} member{s.memberCount === 1 ? '' : 's'}
          </p>
          <Link
            href={`/squads/room/${s.slug}`}
            className="mt-2 inline-flex text-[11px] font-semibold text-[#5EBBFF] hover:underline"
          >
            Open room →
          </Link>
        </li>
      ))}
    </ul>
  );
}
