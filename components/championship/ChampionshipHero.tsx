'use client';

import { ChevronDown, Globe2, Trophy } from 'lucide-react';
import { PtcsLockup } from '@/components/championship/PtcsLockup';
import { CHAMPIONSHIP_REGIONS } from '@/lib/championship/config';
import { PTCS_SOLO_WEEKLY_STAKES, PTCS_STAKES_TAGLINE } from '@/lib/championship/stakes';
import type { ChampionshipEvent, ChampionshipRegion } from '@/lib/championship/types';
import { countdownLabel } from '@/lib/championship/time';
import { EVENT_STATUS_LABEL, eventStatusTone } from '@/lib/championship/uiCopy';
import { cn } from '@/lib/utils/cn';

interface ChampionshipHeroProps {
  event: ChampionshipEvent;
  region: ChampionshipRegion;
  onRegionChange: (region: ChampionshipRegion) => void;
  now: Date;
}

export function ChampionshipHero({ event, region, onRegionChange, now }: ChampionshipHeroProps) {
  const regionMeta = CHAMPIONSHIP_REGIONS[region];
  const isLive = event.status === 'live';
  const podium = PTCS_SOLO_WEEKLY_STAKES.filter((t) => t.highlight);

  return (
    <header className="relative shrink-0 overflow-hidden border-b border-border-subtle">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_140%_at_0%_-20%,rgb(var(--accent-primary-rgb)/0.22),transparent_50%),radial-gradient(ellipse_70%_90%_at_100%_110%,rgb(var(--accent-glow-rgb)/0.14),transparent_45%)]"
        aria-hidden
      />
      <PtcsLockup variant="watermark" className="absolute -right-4 top-1/2 -translate-y-1/2 sm:right-2" />

      <div className="relative px-3 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          {/* Left — identity + cup */}
          <div className="min-w-0 flex-1 space-y-3">
            <PtcsLockup variant="lg" />
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-fg-primary sm:text-[1.75rem]">
                {event.weekLabel}
              </h1>
              <p className="mt-0.5 text-sm text-fg-secondary">
                {event.seasonLabel} · {regionMeta.shortLabel} · Mon→Sun
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
                  eventStatusTone(event.status),
                )}
              >
                {isLive ? (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-bull opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-signal-bull" />
                  </span>
                ) : null}
                {EVENT_STATUS_LABEL[event.status]}
              </span>
              <span className="rounded-sm border border-border-subtle/80 bg-bg-base/60 px-2.5 py-1 font-mono text-[11px] tabular-nums text-fg-primary">
                {countdownLabel(event, now)}
              </span>
            </div>
          </div>

          {/* Center — on the line (FN-style stakes) */}
          <div className="min-w-0 flex-[1.4] xl:max-w-xl">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 shrink-0 text-accent-glow" aria-hidden />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-glow">On the line</p>
            </div>
            <p className="mt-1 text-[11px] text-fg-muted">{PTCS_STAKES_TAGLINE}</p>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {podium.map((tier) => (
                <div
                  key={tier.rank}
                  className={cn(
                    'rounded-md border px-2.5 py-2.5 text-center',
                    tier.rank === '1st'
                      ? 'border-accent-glow/40 bg-accent-glow/[0.12] shadow-[0_0_28px_-12px_rgb(var(--accent-glow-rgb)/0.5)]'
                      : 'border-border-subtle/70 bg-bg-raised/50',
                  )}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-fg-muted">{tier.rank}</p>
                  <p className="mt-1 font-mono text-lg font-black tabular-nums text-fg-primary">
                    +{tier.placementPts}
                  </p>
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-fg-secondary">Placement</p>
                  {tier.wcQp ? (
                    <p className="mt-1 font-mono text-[10px] tabular-nums text-accent-primary">+{tier.wcQp} WC QP</p>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-fg-muted">
              Top 10 solo earn World Cup qualifier points each finalized week. Full payout table in Rules.
            </p>
          </div>

          {/* Right — region */}
          <div className="flex shrink-0 flex-col gap-1 xl:items-end">
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
              <Globe2 className="h-3.5 w-3.5" aria-hidden />
              Region
            </label>
            <div className="relative">
              <select
                value={region}
                onChange={(e) => onRegionChange(e.target.value as ChampionshipRegion)}
                className={cn(
                  'appearance-none rounded-sm border border-border-subtle bg-bg-raised/90 py-2 pl-3 pr-9',
                  'text-sm font-medium text-fg-primary outline-none backdrop-blur-sm focus:border-accent-primary/50',
                )}
                aria-label="Championship region"
              >
                {(Object.keys(CHAMPIONSHIP_REGIONS) as ChampionshipRegion[]).map((key) => (
                  <option key={key} value={key}>
                    {CHAMPIONSHIP_REGIONS[key].label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted"
                aria-hidden
              />
            </div>
            <p className="text-[10px] text-fg-muted">{regionMeta.timeZone}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
