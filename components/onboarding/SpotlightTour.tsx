'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  queryVisibleTarget,
  sameSpotlightHole,
  type SpotlightHole,
} from '@/lib/onboarding/spotlightTourUtils';
import { cn } from '@/lib/utils/cn';

export type SpotlightTourStep = {
  selector: string;
  title: string;
  body: string;
};

type SpotlightTourProps = {
  active: boolean;
  stepIndex: number;
  steps: SpotlightTourStep[];
  onNext: () => void;
  onExitRequest: () => void;
  /** Extra deps that should trigger hole re-measure (layout changes, etc.). */
  remeasureKeys?: unknown[];
};

export function SpotlightTour({
  active,
  stepIndex,
  steps,
  onNext,
  onExitRequest,
  remeasureKeys = [],
}: SpotlightTourProps) {
  const [hole, setHole] = useState<SpotlightHole | null>(null);
  const holeRef = useRef<SpotlightHole | null>(null);

  const idx = Math.min(Math.max(0, stepIndex), steps.length - 1);
  const copy = steps[idx]!;
  const isLast = idx >= steps.length - 1;

  const updateHole = useCallback(() => {
    if (!active) return;
    const selector = steps[idx]?.selector;
    if (!selector) {
      if (holeRef.current !== null) {
        holeRef.current = null;
        setHole(null);
      }
      return;
    }
    const el = queryVisibleTarget(selector);
    if (!el) {
      if (holeRef.current !== null) {
        holeRef.current = null;
        setHole(null);
      }
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = 10;
    const next: SpotlightHole = {
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    };
    if (!sameSpotlightHole(holeRef.current, next)) {
      holeRef.current = next;
      setHole(next);
    }
  }, [active, idx, steps]);

  useLayoutEffect(() => {
    if (!active) {
      holeRef.current = null;
      setHole(null);
      return;
    }
    updateHole();
  }, [active, updateHole, stepIndex, ...remeasureKeys]);

  useEffect(() => {
    if (!active) return;
    const delays = [0, 60, 150, 300, 500, 800];
    const timers = delays.map((d) => window.setTimeout(updateHole, d));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [active, updateHole, stepIndex]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener('resize', updateHole);
    window.addEventListener('scroll', updateHole, true);
    return () => {
      window.removeEventListener('resize', updateHole);
      window.removeEventListener('scroll', updateHole, true);
    };
  }, [active, updateHole]);

  if (!active) return null;

  const SCRIM = 'absolute bg-black/55 cursor-default';

  return (
    <div className="fixed inset-0 z-[260]" role="dialog" aria-modal="true" aria-labelledby="spotlight-tour-title">
      {!hole ? (
        <button
          type="button"
          className="absolute inset-0 bg-black/55"
          aria-label="Exit tour"
          onClick={onExitRequest}
        />
      ) : (
        <>
          <button
            type="button"
            className={SCRIM}
            style={{ top: 0, left: 0, right: 0, height: Math.max(0, hole.top) }}
            aria-label="Exit tour"
            onClick={onExitRequest}
          />
          <button
            type="button"
            className={SCRIM}
            style={{
              top: hole.top,
              left: 0,
              width: Math.max(0, hole.left),
              height: hole.height,
            }}
            aria-label="Exit tour"
            onClick={onExitRequest}
          />
          <button
            type="button"
            className={SCRIM}
            style={{
              top: hole.top,
              left: hole.left + hole.width,
              right: 0,
              height: hole.height,
            }}
            aria-label="Exit tour"
            onClick={onExitRequest}
          />
          <button
            type="button"
            className={SCRIM}
            style={{
              top: hole.top + hole.height,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            aria-label="Exit tour"
            onClick={onExitRequest}
          />
          <div
            className="pointer-events-none absolute rounded-lg border-2 border-accent-primary shadow-[0_0_0_4px_rgba(0,0,0,0.25)]"
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
            }}
            aria-hidden
          />
        </>
      )}

      <div
        className={cn(
          'absolute left-1/2 z-[262] w-[min(92vw,380px)] -translate-x-1/2 border border-border-subtle bg-bg-base p-4 shadow-xl',
          'bottom-[max(5.5rem,env(safe-area-inset-bottom,0px)+1rem)] sm:bottom-10',
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <p id="spotlight-tour-title" className="text-sm font-semibold text-fg-primary">
          {copy.title}
          <span className="ml-2 font-normal text-fg-muted">
            ({idx + 1}/{steps.length})
          </span>
        </p>
        <p className="mt-2 text-xs leading-relaxed text-fg-secondary">{copy.body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onExitRequest}
            className="btn-press rounded-sm border border-border-subtle px-3 py-1.5 text-xs font-medium text-fg-secondary hover:text-fg-primary"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={onNext}
            className="btn-press rounded-sm bg-accent-primary px-3 py-1.5 text-xs font-medium text-fg-inverse hover:bg-accent-glow"
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
