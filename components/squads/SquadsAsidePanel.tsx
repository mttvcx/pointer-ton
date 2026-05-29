'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Megaphone,
  MessageSquare,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { DEMO_CHAT, DEMO_SQUADS } from '@/lib/squads/demo';
import { closeSquadsRail } from '@/lib/squads/openSquadsOnPulse';
import { SquadMonogram } from '@/components/squads/squadsPrimitives';
import { cn } from '@/lib/utils/cn';

type SquadsTab = 'rooms' | 'updates';

export function SquadsAsidePanel({ dock = 'right' }: { dock?: 'left' | 'right' }) {
  const router = useRouter();
  const [tab, setTab] = useState<SquadsTab>('rooms');
  const [activeSlug, setActiveSlug] = useState(DEMO_SQUADS[0]?.slug ?? '');

  const activeSquad = useMemo(
    () => DEMO_SQUADS.find((s) => s.slug === activeSlug) ?? DEMO_SQUADS[0],
    [activeSlug],
  );

  return (
    <section
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg-raised"
      data-dock={dock}
    >
      <header className="sticky top-0 z-[2] shrink-0 border-b border-white/[0.1] bg-bg-hover shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.05)]">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" aria-hidden />
              <h2 className="truncate text-[13px] font-semibold uppercase tracking-wide text-fg-primary">
                {activeSquad?.name ?? 'Squads'}
              </h2>
            </div>
            <p className="mt-0.5 truncate text-[10px] text-fg-muted">Shared rooms · signals · votes</p>
          </div>
          <button
            type="button"
            title="Hide squads"
            aria-label="Hide squads panel"
            onClick={() => closeSquadsRail()}
            className="btn-press flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-border-subtle text-fg-muted transition hover:bg-bg-sunken hover:text-fg-primary"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="flex items-center gap-2 border-t border-white/[0.06] px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {DEMO_SQUADS.slice(0, 3).map((s) => (
              <button
                key={s.slug}
                type="button"
                title={s.name}
                onClick={() => setActiveSlug(s.slug)}
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold transition',
                  activeSlug === s.slug
                    ? 'border-violet-400/70 bg-violet-500/15 text-violet-200'
                    : 'border-white/[0.08] bg-bg-sunken text-fg-muted hover:border-white/15 hover:text-fg-secondary',
                )}
              >
                {s.monogram.slice(0, 2)}
              </button>
            ))}
            <Link
              href="/squads/recruit"
              title="Create or join a squad"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-white/[0.12] text-fg-muted transition hover:border-violet-400/40 hover:text-violet-200"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
            </Link>
          </div>
          <div className="shrink-0 text-right text-[10px] tabular-nums text-fg-muted">
            <span className="text-fg-secondary">{activeSquad?.members ?? 0}</span> members
          </div>
        </div>

        <nav className="flex border-t border-white/[0.06]">
          {(
            [
              ['rooms', 'Rooms', Users],
              ['updates', 'Updates', MessageSquare],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition',
                tab === id
                  ? 'border-b-2 border-violet-400 text-fg-primary'
                  : 'text-fg-muted hover:text-fg-secondary',
              )}
            >
              <Icon className="h-3 w-3" strokeWidth={2.2} aria-hidden />
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {tab === 'rooms' ? (
          <ul className="min-h-0 flex-1 divide-y divide-white/[0.05] overflow-y-auto">
            {DEMO_SQUADS.map((squad) => (
              <li key={squad.slug}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSlug(squad.slug);
                    router.push(`/squads/room/${encodeURIComponent(squad.slug)}`);
                  }}
                  className={cn(
                    'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition hover:bg-white/[0.03]',
                    activeSlug === squad.slug && 'bg-violet-500/[0.06]',
                  )}
                >
                  <SquadMonogram size="sm">{squad.monogram.slice(0, 2)}</SquadMonogram>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-fg-primary">{squad.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-fg-muted">
                      {squad.shortDescription}
                    </p>
                    <p className="mt-1 text-[10px] text-fg-muted">
                      {squad.members} members · {squad.trustMode}
                    </p>
                  </div>
                  <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-muted" strokeWidth={2} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="min-h-0 flex-1 divide-y divide-white/[0.05] overflow-y-auto px-3 py-2">
            {DEMO_CHAT.map((msg) => (
              <li key={msg.id} className="py-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-semibold text-violet-200">{msg.who}</span>
                  <span className="text-[10px] tabular-nums text-fg-muted">{msg.at}</span>
                </div>
                <p className="mt-0.5 text-[11.5px] leading-snug text-fg-secondary">{msg.text}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="shrink-0 border-t border-white/[0.06] bg-bg-hover/80 p-2">
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-bg-sunken/80 px-2.5 py-2">
            <Megaphone className="h-3.5 w-3.5 shrink-0 text-fg-muted" strokeWidth={2} aria-hidden />
            <input
              type="text"
              readOnly
              placeholder="Send a message…"
              className="min-w-0 flex-1 bg-transparent text-[11.5px] text-fg-primary placeholder:text-fg-muted focus:outline-none"
              onFocus={() => {
                if (activeSquad) {
                  router.push(`/squads/room/${encodeURIComponent(activeSquad.slug)}`);
                }
              }}
            />
            <Link
              href={activeSquad ? `/squads/room/${encodeURIComponent(activeSquad.slug)}` : '/squads/my'}
              className="shrink-0 rounded-md border border-violet-400/35 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-200 transition hover:bg-violet-500/20"
            >
              Open
            </Link>
          </div>
          <Link
            href="/squads/my"
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-medium text-fg-muted transition hover:text-fg-primary"
          >
            All squads
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
