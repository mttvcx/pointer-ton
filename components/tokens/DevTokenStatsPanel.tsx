'use client';

import { cn } from '@/lib/utils/cn';
import { formatCompactUsd } from '@/lib/format';
import type { SyntheticDevTokenRow } from '@/lib/dev/demoTokenFixtures';

type Props = {
  tokens: SyntheticDevTokenRow[];
  lastLaunchAgo: string;
  className?: string;
};

export function DevTokenStatsPanel({ tokens, lastLaunchAgo, className }: Props) {
  const migrated = tokens.filter((t) => t.migrated).length;
  const nonMigrated = tokens.length - migrated;
  const total = tokens.length || 1;
  const migrationPct = Math.round((migrated / total) * 100);

  const topByMcap = [...tokens].sort((a, b) => b.mcUsd - a.mcUsd)[0];

  return (
    <aside className={cn('flex flex-col gap-3 p-3', className)}>
      <section className="rounded-md border border-border-subtle bg-bg-raised/40 p-3">
        <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-fg-secondary">
          Token Stats
        </h4>
        <ul className="space-y-1.5">
          <li className="flex items-center gap-2 text-[12px]">
            <span className="inline-block h-2 w-2 rounded-sm bg-signal-bull" />
            <span className="text-fg-secondary">Migrated:</span>
            <span className="font-mono tabular-nums text-fg-primary">{migrated}</span>
          </li>
          <li className="flex items-center gap-2 text-[12px]">
            <span className="inline-block h-2 w-2 rounded-sm bg-signal-bear" />
            <span className="text-fg-secondary">Non-migrated:</span>
            <span className="font-mono tabular-nums text-fg-primary">{nonMigrated}</span>
          </li>
        </ul>
      </section>

      <section className="rounded-md border border-border-subtle bg-bg-raised/40 p-3">
        <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-fg-secondary">
          Highlights
        </h4>
        <div className="space-y-2.5">
          {topByMcap ? (
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-fg-muted">Top MCAP</div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-[12px] font-medium text-fg-primary">
                  {topByMcap.symbol}
                </span>
                <span className="text-[11px] font-mono tabular-nums text-fg-muted">
                  ({formatCompactUsd(topByMcap.mcUsd)})
                </span>
              </div>
            </div>
          ) : null}
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-fg-muted">
              Last Token Launched
            </div>
            <div className="mt-0.5 text-[12px] text-fg-secondary">{lastLaunchAgo}</div>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-border-subtle bg-bg-raised/40 p-4">
        <div className="flex flex-col items-center justify-center">
          <MigrationDonut pct={migrationPct} />
          <div className="mt-2 text-center">
            <div className="text-[11px] uppercase tracking-wide text-fg-muted">Migrated</div>
          </div>
        </div>
      </section>
    </aside>
  );
}

function MigrationDonut({ pct }: { pct: number }) {
  const size = 140;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--border-subtle-rgb))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--signal-bull-rgb))"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[22px] font-semibold font-mono tabular-nums text-fg-primary">
          {pct}%
        </span>
      </div>
    </div>
  );
}
