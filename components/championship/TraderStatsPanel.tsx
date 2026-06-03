'use client';

import type { ChampionshipLeaderboardEntry } from '@/lib/championship/types';
import { ScoreLegend, ScoreRing, type ScoreRingSegment } from '@/components/championship/ScoreRing';
import { formatCompactUsd, formatNumber, formatPercent } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';

function scoreSegments(entry: ChampionshipLeaderboardEntry): ScoreRingSegment[] {
  const { score } = entry;
  const performance = (score.pnlPoints + score.profitEventPoints) * score.roiMultiplier;
  return [
    { id: 'perf', label: 'Performance', value: performance, color: 'rgb(var(--accent-primary-rgb))' },
    { id: 'vol', label: 'Volume', value: score.volumePoints, color: 'rgb(var(--signal-info-rgb))' },
    { id: 'place', label: 'Placement', value: score.placementPoints, color: 'rgb(var(--accent-glow-rgb))' },
  ];
}

interface TraderStatsPanelProps {
  entry: ChampionshipLeaderboardEntry | null;
  isViewer?: boolean;
  emptyLabel?: string;
}

export function TraderStatsPanel({ entry, isViewer, emptyLabel }: TraderStatsPanelProps) {
  if (!entry) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-border-subtle/60 bg-bg-raised/40 px-6 py-8 text-center">
        <p className="text-sm text-fg-muted">{emptyLabel ?? 'Select a trader to view stats'}</p>
      </div>
    );
  }

  const { participant, score } = entry;
  const segments = scoreSegments(entry);
  const ringTotal = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0) || score.finalScore;

  const stats = [
    { label: 'Realized PnL', value: formatCompactUsd(participant.realizedPnlUsd), tone: participant.realizedPnlUsd >= 0 ? 'bull' : 'bear' },
    { label: 'ROI', value: formatPercent(participant.roiPct, { sign: true }), tone: 'neutral' },
    { label: 'Volume', value: formatCompactUsd(participant.eventVolumeUsd), tone: 'neutral' },
    { label: 'Closed trades', value: String(participant.closedTrades), tone: 'neutral' },
    { label: 'Best trade', value: formatPercent(participant.biggestWinRoiPct, { sign: true }), tone: 'neutral' },
  ] as const;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-md border border-border-subtle/60 bg-bg-raised/50">
      <div className="shrink-0 border-b border-border-subtle/50 px-4 py-3 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fg-muted">
              {isViewer ? 'Your stats' : 'Trader stats'}
            </p>
            <h3 className="mt-0.5 truncate text-lg font-bold tracking-tight text-fg-primary">
              {participant.displayName}
            </h3>
            {participant.handle ? (
              <p className="truncate text-xs text-fg-muted">@{participant.handle}</p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-fg-muted">Rank</p>
            <p className="font-mono text-2xl font-black tabular-nums text-accent-primary">#{entry.rank}</p>
          </div>
        </div>
      </div>

      <ul className="shrink-0 space-y-0 divide-y divide-border-subtle/40 px-4 sm:px-5">
        {stats.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-4 py-2 text-sm">
            <span className="text-fg-muted">{row.label}</span>
            <span
              className={cn(
                'font-mono tabular-nums font-semibold',
                row.tone === 'bull' && 'text-signal-bull',
                row.tone === 'bear' && 'text-signal-bear',
                row.tone === 'neutral' && 'text-fg-primary',
              )}
            >
              {row.value}
            </span>
          </li>
        ))}
        <li className="flex items-center justify-between gap-4 py-2 text-sm">
          <span className="text-fg-muted">ROI multiplier</span>
          <span className="font-mono tabular-nums font-semibold text-fg-primary">{score.roiMultiplier.toFixed(2)}×</span>
        </li>
      </ul>

      <div className="mt-auto shrink-0 border-t border-border-subtle/50 bg-bg-base/30 px-4 py-4 sm:px-5">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ScoreRing total={score.finalScore} segments={segments} size={140} />
          <ScoreLegend segments={segments} total={ringTotal} layout="stack" />
        </div>
        {score.drawdownMultiplier < 1 ? (
          <p className="mt-2 text-center text-[10px] text-fg-muted sm:text-left">
            Drawdown · {score.drawdownMultiplier.toFixed(2)}× applied
          </p>
        ) : null}
      </div>
    </div>
  );
}
