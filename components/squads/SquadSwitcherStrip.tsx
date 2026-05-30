'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { DemoSquad } from '@/lib/squads/demo';
import { cn } from '@/lib/utils/cn';

export function SquadSwitcherStrip({
  squads,
  activeSlug,
  onSelect,
  onBrowse,
  trailing,
}: {
  squads: DemoSquad[];
  activeSlug: string;
  onSelect: (slug: string) => void;
  onBrowse: () => void;
  trailing?: ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const refreshScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    refreshScroll();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', refreshScroll, { passive: true });
    const ro = new ResizeObserver(refreshScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', refreshScroll);
      ro.disconnect();
    };
  }, [refreshScroll, squads.length]);

  function nudge(dir: -1 | 1) {
    scrollerRef.current?.scrollBy({ left: dir * 120, behavior: 'smooth' });
  }

  return (
    <div className="flex shrink-0 items-stretch border-b border-border-subtle bg-bg-base/30">
      <div className="relative min-w-0 flex-1">
        {canLeft ? (
          <button
            type="button"
            aria-label="Scroll squads left"
            onClick={() => nudge(-1)}
            className="absolute left-0 z-[1] flex h-full w-7 items-center justify-center bg-gradient-to-r from-bg-base via-bg-base/90 to-transparent text-fg-muted hover:text-fg-primary"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        ) : null}

        <div
          ref={scrollerRef}
          className="flex min-w-0 gap-1 overflow-x-auto px-2 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {squads.map((s) => {
            const active = s.slug === activeSlug;
            return (
              <button
                key={s.slug}
                type="button"
                onClick={() => onSelect(s.slug)}
                className={cn(
                  'btn-press flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition',
                  active
                    ? 'bg-accent-primary/15 text-fg-primary ring-1 ring-accent-primary/35'
                    : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold',
                    active ? 'bg-accent-primary/25 text-accent-primary' : 'bg-bg-hover text-fg-muted',
                  )}
                >
                  {s.monogram}
                </span>
                <span className="max-w-[6.5rem] truncate">{s.name}</span>
              </button>
            );
          })}
          <button
            type="button"
            title="Browse squads"
            onClick={onBrowse}
            className="btn-press flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-fg-muted transition hover:bg-bg-hover hover:text-fg-secondary"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
        </div>

        {canRight ? (
          <button
            type="button"
            aria-label="Scroll squads right"
            onClick={() => nudge(1)}
            className="absolute right-0 top-0 z-[1] flex h-full w-7 items-center justify-center bg-gradient-to-l from-bg-base via-bg-base/90 to-transparent text-fg-muted hover:text-fg-primary"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>

      {trailing ? (
        <div className="flex shrink-0 items-center gap-0.5 self-center border-l border-border-subtle py-1 pl-1 pr-1.5">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
