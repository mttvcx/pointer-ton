'use client';

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

const STORAGE_KEY = 'pointer.brief-x';
/** Keep the box clear of the left/right chrome (chains rail, toolbar). */
const SIDE_MARGIN = 240;
const DRAG_THRESHOLD = 3;

function loadOffset(): number {
  if (typeof window === 'undefined') return 0;
  const v = Number(localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(v) ? v : 0;
}

/**
 * Wraps the hover-briefing box so the user can nudge it HORIZONTALLY only —
 * "a little side to side". The offset is clamped so the box can never slide over
 * the side chrome or off-screen, and persisted locally. Grab / grabbing cursor.
 */
export function DraggableBrief({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState<number>(() => loadOffset());
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false); // synchronous — state lags a render behind
  const start = useRef({ x: 0, offset: 0 });

  const clamp = useCallback((next: number) => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const w = ref.current?.clientWidth ?? 440;
    const maxOffset = Math.max(0, (vw - w) / 2 - SIDE_MARGIN);
    return Math.max(-maxOffset, Math.min(maxOffset, next));
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // Let clicks on interactive children through — only drag the card body.
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select, [role="button"]')) return;
    start.current = { x: e.clientX, offset };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture best-effort */
    }
    draggingRef.current = true;
    setDragging(true);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - start.current.x;
    if (Math.abs(dx) < DRAG_THRESHOLD) return;
    setOffset(clamp(start.current.offset + dx));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    setOffset((o) => {
      const c = clamp(o);
      try {
        localStorage.setItem(STORAGE_KEY, String(Math.round(c)));
      } catch {
        /* storage unavailable */
      }
      return c;
    });
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ transform: `translateX(${offset}px)`, touchAction: 'none' }}
      className={cn('h-full w-full', dragging ? 'cursor-grabbing select-none' : 'cursor-grab', className)}
    >
      {children}
    </div>
  );
}
