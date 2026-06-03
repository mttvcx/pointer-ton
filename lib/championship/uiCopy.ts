import type { ChampionshipEventStatus, ReviewStatus } from '@/lib/championship/types';

export const PROVISIONAL_LEADERBOARD_COPY =
  'Live rankings are provisional and reviewed before prizes/qualification.';

export const EVENT_STATUS_LABEL: Record<ChampionshipEventStatus, string> = {
  upcoming: 'Upcoming',
  live: 'Live',
  reviewing: 'Reviewing',
  finalized: 'Finalized',
};

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  eligible: 'Eligible',
  low_sample: 'Low sample',
  under_review: 'Under review',
  flagged: 'Flagged',
  disqualified: 'Disqualified',
  finalized: 'Finalized',
};

export function reviewStatusTone(status: ReviewStatus): string {
  switch (status) {
    case 'eligible':
    case 'finalized':
      return 'text-signal-bull border-signal-bull/35 bg-signal-bull/10';
    case 'low_sample':
      return 'text-fg-muted border-border-subtle bg-bg-hover/80';
    case 'under_review':
      return 'text-amber-200 border-amber-500/35 bg-amber-500/10';
    case 'flagged':
      return 'text-signal-bear border-signal-bear/35 bg-signal-bear/10';
    case 'disqualified':
      return 'text-fg-muted border-border-subtle bg-bg-base line-through';
    default:
      return 'text-fg-secondary border-border-subtle bg-bg-hover';
  }
}

export function eventStatusTone(status: ChampionshipEventStatus): string {
  switch (status) {
    case 'live':
      return 'text-signal-bull border-signal-bull/40 bg-signal-bull/10';
    case 'upcoming':
      return 'text-accent-primary border-accent-primary/35 bg-accent-primary/10';
    case 'reviewing':
      return 'text-amber-200 border-amber-500/35 bg-amber-500/10';
    case 'finalized':
      return 'text-fg-secondary border-border-subtle bg-bg-hover';
    default:
      return 'text-fg-muted border-border-subtle bg-bg-base';
  }
}
