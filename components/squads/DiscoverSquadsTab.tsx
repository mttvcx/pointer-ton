'use client';

import { PhaseLockedCard } from '@/components/squads/PhaseLockedCard';

export function DiscoverSquadsTab() {
  return (
    <PhaseLockedCard
      phase="Phase 3"
      title="Discover Squads"
      intent="Search desks by chain, style, Ethos floor, and membership rules. Public rooms and request-only rooms appear here first."
      bullets={[
        'Each card shows signal grade, chains, mutuals, and how you get in.',
        'Join open rooms in one tap, or send a short request elsewhere.',
        'Sort is fixed by signal and tenure—not an engagement leaderboard.',
      ]}
    />
  );
}
