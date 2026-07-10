'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import type { MissionProgress } from '@/lib/points/missions';

const SCALE = 1000; // matches the points display scale

export function DailyMissions() {
  const { getAccessToken, authenticated } = usePointerAuth();
  const [missions, setMissions] = useState<MissionProgress[] | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    let alive = true;
    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch('/api/points/missions', { headers: { Authorization: `Bearer ${token}` } });
        const j = (await res.json()) as { missions?: MissionProgress[] };
        if (alive) setMissions(Array.isArray(j.missions) ? j.missions : []);
      } catch {
        if (alive) setMissions([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authenticated, getAccessToken]);

  if (!missions || missions.length === 0) return null;
  const done = missions.filter((m) => m.done).length;

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-raised/40 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-semibold text-fg-primary">Missions</h3>
          <p className="text-[11px] text-fg-muted">Reset daily · knock these out to stack points</p>
        </div>
        <span className="rounded-full border border-border-subtle bg-bg-sunken/50 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-fg-secondary">
          {done}/{missions.length}
        </span>
      </div>
      <div className="space-y-2">
        {missions.map((m) => (
          <div
            key={m.id}
            className={cn(
              'flex items-center gap-3 rounded-xl border px-3 py-2.5',
              m.done ? 'border-emerald-500/25 bg-emerald-950/15' : 'border-border-subtle bg-bg-base/30',
            )}
          >
            <div
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                m.done ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300' : 'border-border-subtle text-fg-muted',
              )}
            >
              {m.done ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <span className="text-[10px] font-bold tabular-nums">{m.target > 1 ? m.progress : ''}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn('truncate text-[13px] font-medium', m.done ? 'text-fg-secondary line-through' : 'text-fg-primary')}>
                {m.label}
              </p>
              <p className="truncate text-[11px] text-fg-muted">
                {m.hint}
                {m.target > 1 ? ` · ${m.progress}/${m.target}` : ''}
              </p>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                m.done ? 'text-emerald-300' : 'text-accent-primary',
              )}
            >
              +{formatNumber(m.reward * SCALE)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
