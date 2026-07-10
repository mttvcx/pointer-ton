'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChampionshipLeaderboardEntry } from '@/lib/championship/types';
import { TraderStatsPanel } from '@/components/championship/TraderStatsPanel';
import { PROVISIONAL_LEADERBOARD_COPY } from '@/lib/championship/uiCopy';
import { anonLabel } from '@/lib/championship/privacy';
import { formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';

interface SoloLeaderboardArenaProps {
  entries: ChampionshipLeaderboardEntry[];
  viewerUserId?: string | null;
  emptyMessage?: string;
  /** Which row to pre-select when data loads. */
  focus?: 'viewer' | 'leader';
}

function topPct(rank: number, total: number): string {
  if (total <= 0) return '—';
  const pct = Math.max(1, Math.ceil((rank / total) * 100));
  return `Top ${pct}%`;
}

export function SoloLeaderboardArena({
  entries,
  viewerUserId,
  emptyMessage,
  focus = 'leader',
}: SoloLeaderboardArenaProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userPicked, setUserPicked] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  const defaultId = useMemo(() => {
    if (!entries.length) return null;
    if (focus === 'viewer' && viewerUserId) {
      const mine = entries.find((e) => e.participant.userId === viewerUserId);
      if (mine) return mine.participant.userId;
    }
    return entries[0]?.participant.userId ?? null;
  }, [entries, focus, viewerUserId]);

  useEffect(() => {
    setUserPicked(false);
  }, [focus]);

  useEffect(() => {
    if (!userPicked) setSelectedId(defaultId);
  }, [defaultId, userPicked]);

  const selectTrader = useCallback((userId: string, fromUser = true) => {
    if (fromUser) setUserPicked(true);
    setSelectedId(userId);
    requestAnimationFrame(() => {
      rowRefs.current.get(userId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, []);

  const selected =
    entries.find((e) => e.participant.userId === selectedId) ?? entries[0] ?? null;
  const viewerEntry = viewerUserId
    ? entries.find((e) => e.participant.userId === viewerUserId) ?? null
    : null;
  const isViewerSelected = Boolean(
    viewerUserId && selected?.participant.userId === viewerUserId,
  );

  if (!entries.length) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-md border border-dashed border-border-subtle/70 bg-bg-raised/30 px-6 py-16 text-center">
        <p className="max-w-md text-sm leading-relaxed text-fg-secondary">
          {emptyMessage ?? 'No solo leaderboard entries for this cup yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="mb-2 shrink-0 px-0.5 text-[10px] leading-snug text-fg-muted">{PROVISIONAL_LEADERBOARD_COPY}</p>

      <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto] gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-1 lg:gap-3">
        {/* Left — rank list (only scroll container) */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border-subtle/70 bg-bg-sunken/40 max-lg:min-h-[220px]">
          <div className="shrink-0 border-b border-border-subtle/60 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-muted">Weekly cup · Solo</p>
          </div>
          <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {entries.map((row) => {
              const id = row.participant.userId;
              const isSelected = id === selectedId;
              const isViewer = viewerUserId === id;
              const isFirst = row.rank === 1;

              return (
                <li
                  key={id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(id, el);
                    else rowRefs.current.delete(id);
                  }}
                >
                  <button
                    type="button"
                    onClick={() => selectTrader(id)}
                    className={cn(
                      'btn-press flex w-full items-center gap-3 border-b border-border-subtle/40 px-3 py-2.5 text-left transition',
                      isSelected && 'bg-accent-primary/[0.14] shadow-[inset_3px_0_0_rgb(var(--accent-primary-rgb))]',
                      !isSelected && isViewer && 'bg-accent-primary/[0.06]',
                      !isSelected && isFirst && !isViewer && 'bg-accent-glow/[0.06]',
                      !isSelected && !isFirst && !isViewer && 'hover:bg-bg-hover/50',
                    )}
                  >
                    <span
                      className={cn(
                        'w-9 shrink-0 font-mono text-base font-black tabular-nums',
                        isFirst ? 'text-accent-glow' : 'text-fg-muted',
                      )}
                    >
                      #{row.rank}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-fg-primary">
                      {anonLabel(row.participant.walletAddress, row.participant.userId)}
                    </span>
                    <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-fg-primary">
                      {formatNumber(row.score.finalScore, { decimals: 0 })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right — stats (no scroll) */}
        <div className="min-h-0 overflow-hidden max-lg:min-h-[260px]">
          <TraderStatsPanel
            entry={selected}
            isViewer={isViewerSelected}
            emptyLabel="Select a trader from the list"
          />
        </div>
      </div>

      {/* Bottom YOU bar — click to jump to your stats */}
      {viewerEntry ? (
        <button
          type="button"
          onClick={() => selectTrader(viewerEntry.participant.userId)}
          className={cn(
            'btn-press mt-2 w-full shrink-0 rounded-md border px-4 py-2.5 text-left transition',
            isViewerSelected
              ? 'border-accent-primary/50 bg-accent-primary/[0.14] ring-1 ring-accent-primary/30'
              : 'border-accent-primary/25 bg-accent-primary/[0.08] hover:border-accent-primary/40 hover:bg-accent-primary/[0.12]',
          )}
        >
          <p className="text-sm text-fg-secondary">
            <span className="font-bold uppercase tracking-wide text-accent-primary">You</span>
            <span className="mx-2 text-fg-muted">·</span>
            <span className="font-mono tabular-nums font-semibold text-fg-primary">
              {formatNumber(viewerEntry.score.finalScore, { decimals: 1 })} PTS
            </span>
            <span className="mx-2 text-fg-muted">·</span>
            <span className="font-mono tabular-nums">#{viewerEntry.rank}</span>
            <span className="mx-2 text-fg-muted">·</span>
            <span>{topPct(viewerEntry.rank, entries.length)}</span>
            {!isViewerSelected ? (
              <span className="ml-2 text-[11px] font-medium text-accent-primary">View stats →</span>
            ) : null}
          </p>
        </button>
      ) : null}
    </div>
  );
}
