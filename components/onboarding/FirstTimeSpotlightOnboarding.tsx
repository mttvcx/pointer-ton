'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/store/ui';
import { useCopilotMode } from '@/components/copilot/CopilotModeContext';
import { cn } from '@/lib/utils/cn';
import { HYPE_MINT } from '@/lib/utils/constants';
import { ME_QUERY_KEY, useMeQuery } from '@/lib/hooks/useMe';

const STEP_SELECTORS = [
  '[data-onboarding="pulse-feed"]',
  '[data-onboarding="copilot"]',
  '[data-onboarding="copilot"]',
  '[data-onboarding="instant-trade"]',
] as const;

const STEP_COPY: { title: string; body: string }[] = [
  {
    title: 'Pulse feed',
    body: 'New launches, stretching liquidity, and migrated pairs: your live market radar.',
  },
  {
    title: 'AI co-pilot',
    body: 'Context, alerts, and asks stay pinned in the side panel while you browse tokens and wallets.',
  },
  {
    title: 'Top answer box',
    body: 'Prefer it up top? The same co-pilot also lives in a compact answer box below the toolbar — open it for quick asks without the side panel.',
  },
  {
    title: 'Instant trade',
    body: 'On any token page, open the lightning button in the Trade column for one-tap buy and sell chips.',
  },
];

function queryVisibleTarget(selector: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const nodes = document.querySelectorAll(selector);
  for (const node of nodes) {
    const el = node as HTMLElement;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    return el;
  }
  return null;
}

type Hole = { top: number; left: number; width: number; height: number };

function sameHole(a: Hole | null, b: Hole | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

export function FirstTimeSpotlightOnboarding() {
  const router = useRouter();
  const pathname = usePathname();
  const { getAccessToken } = usePointerAuth();
  const qc = useQueryClient();
  const meQ = useMeQuery();
  const setPanelOpen = useUIStore((s) => s.setPanelOpen);
  const panelOpen = useUIStore((s) => s.panelOpen);
  const { mode: copilotMode, setMode: setCopilotMode } = useCopilotMode();

  const [stepIndex, setStepIndex] = useState(0);
  const [hole, setHole] = useState<Hole | null>(null);
  const holeRef = useRef<Hole | null>(null);
  // Local dismiss so "Done"/"Skip" close instantly instead of waiting on the
  // network round-trip + `me` refetch (which felt laggy).
  const [dismissed, setDismissed] = useState(false);

  const onboardingDone = Boolean(meQ.data?.onboardingCompletedAt);

  const finishMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/me/onboarding', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? 'onboarding_failed');
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: ['announcement', 'pending'] });
    },
  });

  const updateHole = useCallback(() => {
    const idx = Math.min(Math.max(0, stepIndex), STEP_SELECTORS.length - 1);
    const selector = STEP_SELECTORS[idx]!;
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
    const next: Hole = {
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    };
    if (!sameHole(holeRef.current, next)) {
      holeRef.current = next;
      setHole(next);
    }
  }, [stepIndex]);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hole derives from anchor DOM layout
    updateHole();
  }, [updateHole, pathname, panelOpen, copilotMode]);

  // Re-measure a few times after each step change so spotlight targets that
  // mount or animate in (side panel, top answer box) get encircled instead of
  // leaving a full black overlay.
  useEffect(() => {
    const delays = [0, 60, 150, 300, 500, 800];
    const timers = delays.map((d) => window.setTimeout(updateHole, d));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [updateHole]);

  useEffect(() => {
    window.addEventListener('resize', updateHole);
    window.addEventListener('scroll', updateHole, true);
    return () => {
      window.removeEventListener('resize', updateHole);
      window.removeEventListener('scroll', updateHole, true);
    };
  }, [updateHole]);

  useEffect(() => {
    /** Only steer to Pulse during step 0 while the spotlight is actually shown. */
    if (onboardingDone || !meQ.data || meQ.isLoading) return;
    if (stepIndex !== 0) return;
    if (pathname !== '/pulse' && pathname !== '/') {
      router.replace('/pulse');
    }
  }, [stepIndex, pathname, router, onboardingDone, meQ.data, meQ.isLoading]);

  /** Step 1 — co-pilot side panel. */
  useEffect(() => {
    if (stepIndex !== 1) return;
    setCopilotMode('sidebar');
    setPanelOpen(true);
  }, [stepIndex, setCopilotMode, setPanelOpen]);

  /** Step 2 — top answer box (embedded strip, panel closed). */
  useEffect(() => {
    if (stepIndex !== 2) return;
    setPanelOpen(false);
    setCopilotMode('embedded');
  }, [stepIndex, setCopilotMode, setPanelOpen]);

  /** Step 3 — instant trade on a token page. */
  useEffect(() => {
    if (onboardingDone || !meQ.data || meQ.isLoading) return;
    if (stepIndex !== 3) return;
    if (!pathname.startsWith('/token/')) {
      router.replace(`/token/${encodeURIComponent(HYPE_MINT)}`);
    }
  }, [stepIndex, pathname, router, onboardingDone, meQ.data, meQ.isLoading]);

  const finish = useCallback(() => {
    // Close instantly; persist in the background.
    setDismissed(true);
    setPanelOpen(false);
    setCopilotMode('embedded');
    finishMutation.mutate();
  }, [finishMutation, setPanelOpen, setCopilotMode]);

  const onNext = useCallback(() => {
    if (stepIndex < STEP_SELECTORS.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }
    finish();
  }, [stepIndex, finish]);

  if (dismissed || !meQ.data || meQ.isLoading || onboardingDone) return null;

  const idx = Math.min(Math.max(0, stepIndex), STEP_COPY.length - 1);
  const copy = STEP_COPY[idx]!;
  const isLast = idx >= STEP_SELECTORS.length - 1;
  const SCRIM = 'absolute bg-black/55';

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      {!hole ? (
        <div className="absolute inset-0 bg-black/55" aria-hidden />
      ) : (
        <>
          <div
            className={SCRIM}
            style={{ top: 0, left: 0, right: 0, height: Math.max(0, hole.top) }}
            aria-hidden
          />
          <div
            className={SCRIM}
            style={{
              top: hole.top,
              left: 0,
              width: Math.max(0, hole.left),
              height: hole.height,
            }}
            aria-hidden
          />
          <div
            className={SCRIM}
            style={{
              top: hole.top,
              left: hole.left + hole.width,
              right: 0,
              height: hole.height,
            }}
            aria-hidden
          />
          <div
            className={SCRIM}
            style={{
              top: hole.top + hole.height,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            aria-hidden
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
          'absolute left-1/2 z-[102] w-[min(92vw,380px)] -translate-x-1/2 border border-border-subtle bg-bg-base p-4 shadow-xl',
          'bottom-[max(5.5rem,env(safe-area-inset-bottom,0px)+1rem)] sm:bottom-10',
        )}
      >
        <p id="onb-title" className="text-sm font-semibold text-fg-primary">
          {copy.title}
          <span className="ml-2 font-normal text-fg-muted">
            ({idx + 1}/{STEP_SELECTORS.length})
          </span>
        </p>
        <p className="mt-2 text-xs leading-relaxed text-fg-secondary">{copy.body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => finish()}
            className="btn-press rounded-sm border border-border-subtle px-3 py-1.5 text-xs font-medium text-fg-secondary hover:text-fg-primary"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => onNext()}
            className="btn-press rounded-sm bg-accent-primary px-3 py-1.5 text-xs font-medium text-fg-inverse hover:bg-accent-glow"
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
