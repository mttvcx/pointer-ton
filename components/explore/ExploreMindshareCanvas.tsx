'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { TokenExploreItem } from '@/types/explore';
import { ExploreTokenBubble } from '@/components/explore/ExploreTokenBubble';
import {
  resolveBubbleRadius,
  useBubbleForceSimulation,
} from '@/components/explore/hooks/useBubbleForceSimulation';

type Props = {
  items: TokenExploreItem[];
  searchQuery: string;
  selectedAddress: string | null;
  hoveredAddress: string | null;
  onHover: (mint: string | null) => void;
  onSelect: (mint: string) => void;
  onOpenTokenPage: (mint: string) => void;
  /** Prefer-less-motion users: smaller easing, shorter settle. */
  reducedMotion: boolean;
  /** Live/pause toggle. Field stays put except during user interaction either way,
   * so this only affects whether the indicator pill in controls is green. */
  layoutFrozen: boolean;
};

export function ExploreMindshareCanvas({
  items,
  searchQuery,
  selectedAddress,
  hoveredAddress,
  onHover,
  onSelect,
  onOpenTokenPage,
  reducedMotion,
  layoutFrozen,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const measure = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setBox({ w: Math.floor(r.width), h: Math.floor(r.height) });
  }, []);

  useLayoutEffect(() => {
    measure();
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  /* Treat "paused" identically to reduced-motion at the simulation layer —
   * shorter cool-down, no idle drift, faster settle. Dragging itself is
   * always allowed. */
  const sim = useBubbleForceSimulation({
    items,
    box,
    containerRef: wrapRef,
    reducedMotion: reducedMotion || layoutFrozen,
  });

  const q = searchQuery.trim().toLowerCase();
  const ready = box.w >= 80 && box.h >= 80;

  const radii = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.tokenAddress, resolveBubbleRadius(it, box));
    return m;
  }, [items, box]);

  return (
    <div
      ref={wrapRef}
      className={cn(
        'group/canvas relative isolate h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden rounded-xl border border-border-subtle bg-bg-base shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]',
        'min-h-[220px]',
      )}
      style={{ touchAction: 'none' }}
      aria-label="New token bubble field"
    >
      {/* Radial ambience */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 72% 56% at 50% 44%, rgba(0,149,237,0.13) 0%, transparent 62%), radial-gradient(ellipse 55% 45% at 58% 36%, rgba(45,212,191,0.07) 0%, transparent 55%)',
        }}
      />
      {/* Star-field dots */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            'radial-gradient(circle at center, rgba(255,255,255,0.06) 0.85px, transparent 0.95px)',
          backgroundSize: '22px 22px',
        }}
      />
      {/* Subtle inner glow + vignette */}
      <div className="pointer-events-none absolute inset-[1px] rounded-xl bg-gradient-to-b from-bg-raised/90 via-transparent to-bg-base" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_92%,rgba(0,0,0,0.45),transparent_48%)]" />

      {!ready ? (
        <div className="relative z-[1] flex min-h-[200px] flex-1 items-center justify-center text-[12px] text-fg-muted">
          Packing mindshare…
        </div>
      ) : null}

      {ready ? (
        <div
          className="relative z-[2] h-full w-full"
          style={{ minHeight: box.h }}
        >
          {items.map((it) => {
            const r = radii.get(it.tokenAddress) ?? resolveBubbleRadius(it, box);
            const match =
              !q ||
              it.ticker.toLowerCase().includes(q) ||
              it.name.toLowerCase().includes(q) ||
              it.tokenAddress.toLowerCase().includes(q);
            return (
              <ExploreTokenBubble
                key={it.tokenAddress}
                item={it}
                radius={r}
                match={match}
                hovered={hoveredAddress === it.tokenAddress}
                selected={selectedAddress === it.tokenAddress}
                peerDimmed={Boolean(selectedAddress && selectedAddress !== it.tokenAddress)}
                anyDragging={sim.anyDragging}
                reducedMotion={reducedMotion}
                registerEl={sim.registerEl}
                onHover={onHover}
                onSelect={onSelect}
                onOpenTokenPage={onOpenTokenPage}
                startDrag={sim.startDrag}
                moveDrag={sim.moveDrag}
                endDrag={sim.endDrag}
              />
            );
          })}
        </div>
      ) : null}

      {/* Soft drag affordance: when nothing is touched, a tiny hint surfaces on hover.
         Hidden during interaction so it never feels like UI noise. */}
      <div
        className={cn(
          'pointer-events-none absolute bottom-2.5 left-3 z-[3] hidden text-[10px] text-fg-muted/45 transition-opacity duration-200 lg:block',
          sim.anyDragging || hoveredAddress ? 'opacity-0' : 'opacity-100 group-hover/canvas:opacity-100',
        )}
      >
        Drag to reorganize · click for AI overview · double-click for full page
      </div>
    </div>
  );
}
