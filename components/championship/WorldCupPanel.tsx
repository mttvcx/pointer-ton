'use client';

import { PTCS_SEASON } from '@/lib/championship/config';
import type { WorldCupQualifierEntry } from '@/lib/championship/types';
import { formatNumber } from '@/lib/utils/formatters';
import { Globe, Medal, Trophy } from 'lucide-react';

interface WorldCupPanelProps {
  standings: WorldCupQualifierEntry[];
  lastWeekQualifiers: {
    solo: { rank: number; displayName: string; points: number }[];
    squads: { rank: number; displayName: string; points: number }[];
  };
}

export function WorldCupPanel({ standings, lastWeekQualifiers }: WorldCupPanelProps) {
  const seasonStart = new Date(PTCS_SEASON.startsAt);
  const seasonEnd = new Date(PTCS_SEASON.endsAt);
  const now = new Date();
  const progressPct = Math.min(
    100,
    Math.max(
      0,
      ((now.getTime() - seasonStart.getTime()) / (seasonEnd.getTime() - seasonStart.getTime())) * 100,
    ),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-md border border-border-subtle/70 bg-bg-raised/50 p-5">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgb(var(--accent-primary-rgb)/0.15),transparent_50%)]"
          aria-hidden
        />
        <div className="relative flex items-start gap-3">
          <Globe className="mt-0.5 h-5 w-5 shrink-0 text-accent-primary" aria-hidden />
          <div>
            <h2 className="text-base font-bold tracking-tight text-fg-primary">World Cup Qualification</h2>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-fg-secondary">
              Top 10 solo and top 3 squads each finalized week earn qualifier points toward the season
              finals.
            </p>
            <p className="mt-2 text-xs font-medium text-accent-primary">Finals details coming soon</p>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border-subtle/70 bg-bg-sunken/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-fg-primary">{PTCS_SEASON.label}</h3>
          <span className="font-mono text-xs tabular-nums text-fg-muted">{progressPct.toFixed(0)}%</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg-hover">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-glow transition-[width]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <QualifierList title="Last week · solo" rows={lastWeekQualifiers.solo} empty="No finalized solo qualifiers yet." />
        <QualifierList title="Last week · squads" rows={lastWeekQualifiers.squads} empty="No finalized squad qualifiers yet." />
      </div>

      <div className="overflow-hidden rounded-md border border-border-subtle/70">
        <div className="flex items-center gap-2 border-b border-border-subtle/60 bg-bg-hover/50 px-4 py-3">
          <Trophy className="h-4 w-4 text-accent-glow" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold text-fg-primary">Qualifier standings</h3>
            <p className="text-[11px] text-fg-muted">Accumulated across finalized cups</p>
          </div>
        </div>
        {!standings.length ? (
          <p className="px-4 py-10 text-center text-sm text-fg-secondary">
            Qualifier points appear after the first finalized weekly cup.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="border-b border-border-subtle/60 text-[10px] uppercase tracking-wider text-fg-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">#</th>
                  <th className="px-4 py-2 font-semibold">Name</th>
                  <th className="px-4 py-2 font-semibold">Type</th>
                  <th className="px-4 py-2 text-right font-semibold">QP</th>
                  <th className="px-4 py-2 text-right font-semibold">Podiums</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr
                    key={`${row.kind}-${row.entityId}`}
                    className="border-b border-border-subtle/40 bg-bg-base/30 last:border-0"
                  >
                    <td className="px-4 py-2.5 font-mono tabular-nums text-fg-muted">{row.rank}</td>
                    <td className="px-4 py-2.5 font-medium text-fg-primary">{row.displayName}</td>
                    <td className="px-4 py-2.5 capitalize text-fg-muted">{row.kind}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-fg-primary">
                      {formatNumber(row.qualifierPoints, { decimals: 0 })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-fg-secondary">
                      {row.weeklyPodiums}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function QualifierList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { rank: number; displayName: string; points: number }[];
  empty: string;
}) {
  return (
    <div className="rounded-md border border-border-subtle/70 bg-bg-raised/40 p-4">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-fg-primary">
        <Medal className="h-4 w-4 text-accent-glow" aria-hidden />
        {title}
      </h4>
      {!rows.length ? (
        <p className="mt-3 text-sm text-fg-muted">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {rows.map((r) => (
            <li
              key={`${r.rank}-${r.displayName}`}
              className="flex items-center justify-between rounded-sm px-2 py-1.5 text-sm odd:bg-bg-base/40"
            >
              <span className="text-fg-secondary">
                <span className="mr-2 font-mono tabular-nums text-fg-muted">#{r.rank}</span>
                {r.displayName}
              </span>
              <span className="font-mono tabular-nums font-semibold text-accent-primary">+{r.points}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
