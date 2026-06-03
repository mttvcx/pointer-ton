'use client';

import { useEffect, useState } from 'react';
import type { SquadLeaderboardEntry } from '@/lib/championship/types';
import { PROVISIONAL_LEADERBOARD_COPY } from '@/lib/championship/uiCopy';
import { formatCompactUsd, formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import { Users } from 'lucide-react';

interface SquadLeaderboardArenaProps {
  entries: SquadLeaderboardEntry[];
  emptyMessage?: string;
  onCreateSquad?: () => void;
  onJoinSquad?: () => void;
  squadActionsDisabled?: boolean;
}

export function SquadLeaderboardArena({
  entries,
  emptyMessage,
  onCreateSquad,
  onJoinSquad,
  squadActionsDisabled = true,
}: SquadLeaderboardArenaProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const defaultId = entries[0]?.squadId ?? null;

  useEffect(() => {
    setSelectedId(defaultId);
  }, [defaultId]);

  const selected = entries.find((e) => e.squadId === selectedId) ?? entries[0] ?? null;

  if (!entries.length) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-md border border-dashed border-border-subtle/70 bg-bg-raised/30 px-6 py-16 text-center">
        <p className="max-w-md text-sm leading-relaxed text-fg-secondary">
          {emptyMessage ?? 'No squad leaderboard entries for this cup yet.'}
        </p>
        <div className="flex gap-2">
          <SquadActionBtn label="Create Squad" disabled={squadActionsDisabled} onClick={onCreateSquad} primary />
          <SquadActionBtn label="Join Squad" disabled={squadActionsDisabled} onClick={onJoinSquad} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-0.5">
        <p className="text-[10px] leading-snug text-fg-muted">{PROVISIONAL_LEADERBOARD_COPY}</p>
        <div className="flex gap-2">
          <SquadActionBtn label="Create Squad" disabled={squadActionsDisabled} onClick={onCreateSquad} primary />
          <SquadActionBtn label="Join Squad" disabled={squadActionsDisabled} onClick={onJoinSquad} />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[1fr] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:min-h-[420px]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border-subtle/70 bg-bg-sunken/40">
          <div className="shrink-0 border-b border-border-subtle/60 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
              Weekly cup · Squads
            </p>
          </div>
          <ol className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {entries.map((row) => {
              const isSelected = row.squadId === selectedId;
              const isFirst = row.rank === 1;
              return (
                <li key={row.squadId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.squadId)}
                    className={cn(
                      'btn-press flex w-full items-center gap-3 border-b border-border-subtle/40 px-3 py-2.5 text-left transition',
                      isSelected && 'bg-accent-primary/[0.12] shadow-[inset_3px_0_0_rgb(var(--accent-primary-rgb))]',
                      !isSelected && isFirst && 'bg-accent-glow/[0.06]',
                      !isSelected && !isFirst && 'hover:bg-bg-hover/50',
                    )}
                  >
                    <span
                      className={cn(
                        'w-8 shrink-0 font-mono text-base font-bold tabular-nums',
                        isFirst ? 'text-accent-glow' : 'text-fg-muted',
                      )}
                    >
                      #{row.rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-fg-primary">{row.squadName}</span>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-fg-primary">
                      {formatNumber(row.combinedScore, { decimals: 0 })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {selected ? (
          <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border-subtle/60 bg-bg-raised/50 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-muted">Squad stats</p>
                <h3 className="mt-1 text-lg font-semibold tracking-tight text-fg-primary">{selected.squadName}</h3>
                <p className="mt-0.5 text-xs text-fg-muted">
                  {selected.membersCounted} of {selected.memberCount} members counted
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Rank</p>
                <p className="font-mono text-2xl font-bold tabular-nums text-accent-primary">#{selected.rank}</p>
              </div>
            </div>

            <ul className="mt-4 space-y-2 border-b border-border-subtle/50 pb-4">
              {[
                {
                  label: 'Combined PnL',
                  value: formatCompactUsd(selected.combinedPnlUsd),
                  tone: selected.combinedPnlUsd >= 0 ? ('bull' as const) : ('bear' as const),
                },
                { label: 'Combined volume', value: formatCompactUsd(selected.combinedVolumeUsd), tone: 'neutral' as const },
                { label: 'PTCS score', value: formatNumber(selected.combinedScore, { decimals: 1 }), tone: 'neutral' as const },
              ].map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-fg-muted">{row.label}</span>
                  <span
                    className={cn(
                      'font-mono tabular-nums font-medium',
                      row.tone === 'bull' && 'text-signal-bull',
                      row.tone === 'bear' && 'text-signal-bear',
                      row.tone === 'neutral' && 'text-fg-primary',
                    )}
                  >
                    {row.value}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 min-h-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">Top contributors</p>
              <ul className="mt-2 space-y-2">
                {selected.topMembers.map((m, i) => (
                  <li
                    key={m.userId}
                    className="flex items-center justify-between rounded-sm bg-bg-base/60 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm text-fg-secondary">
                      <span className="font-mono text-xs tabular-nums text-fg-muted">#{i + 1}</span>
                      <Users className="h-3.5 w-3.5 text-fg-muted" aria-hidden />
                      {m.displayName}
                    </span>
                    <span className="font-mono text-sm tabular-nums font-medium text-fg-primary">
                      {formatNumber(m.score, { decimals: 0 })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SquadActionBtn({
  label,
  disabled,
  onClick,
  primary,
}: {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={disabled ? 'Opens in a later private-beta drop' : undefined}
      className={cn(
        'btn-press rounded-sm border px-3 py-1.5 text-xs font-medium',
        disabled && 'cursor-not-allowed opacity-50',
        primary
          ? 'border-accent-primary/40 text-accent-primary hover:bg-accent-primary/10'
          : 'border-border-subtle text-fg-secondary hover:bg-bg-hover',
      )}
    >
      {label}
    </button>
  );
}
