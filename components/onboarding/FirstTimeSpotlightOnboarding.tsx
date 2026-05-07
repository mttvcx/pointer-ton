'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';
import { HYPE_MINT } from '@/lib/utils/constants';
import { ME_QUERY_KEY, useMeQuery } from '@/lib/hooks/useMe';

const STEP_SELECTORS = [
  '[data-onboarding="pulse-feed"]',
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
    body: 'Context, alerts, and asks stay pinned here while you browse tokens and wallets.',
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

export function FirstTimeSpotlightOnboarding() {
  const router = useRouter();
  const pathname = usePathname();
  const { getAccessToken } = usePointerAuth();
  const qc = useQueryClient();
  const meQ = useMeQuery();
  const setPanelOpen = useUIStore((s) => s.setPanelOpen);
  const panelOpen = useUIStore((s) => s.panelOpen);

  const [stepIndex, setStepIndex] = useState(0);
  const [hole, setHole] = useState<Hole | null>(null);

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
      setHole(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = 10;
    setHole({
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    });
  }, [stepIndex]);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hole derives from anchor DOM layout
    updateHole();
  }, [updateHole, pathname, panelOpen]);

  useEffect(() => {
    window.addEventListener('resize', updateHole);
    window.addEventListener('scroll', updateHole, true);
    return () => {
      window.removeEventListener('resize', updateHole);
      window.removeEventListener('scroll', updateHole, true);
    };
  }, [updateHole]);

  useEffect(() => {
    /** Only steer to Pulse during step 0 while the spotlight is actually shown (hooks run even when we return null after onboarding completes). */
    if (onboardingDone || !meQ.data || meQ.isLoading) return;
    if (stepIndex !== 0) return;
    if (pathname !== '/pulse' && pathname !== '/') {
      router.replace('/pulse');
    }
  }, [stepIndex, pathname, router, onboardingDone, meQ.data, meQ.isLoading]);

  useEffect(() => {
    if (stepIndex !== 1) return;
    const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
    if (wide) setPanelOpen(true);
  }, [stepIndex, setPanelOpen]);

  useEffect(() => {
    if (onboardingDone || !meQ.data || meQ.isLoading) return;
    if (stepIndex !== 2) return;
    if (!pathname.startsWith('/token/')) {
      router.replace(`/token/${encodeURIComponent(HYPE_MINT)}`);
    }
  }, [stepIndex, pathname, router, onboardingDone, meQ.data, meQ.isLoading]);

  const finish = useCallback(() => {
    finishMutation.mutate();
  }, [finishMutation]);

  const onNext = useCallback(() => {
    if (stepIndex < STEP_SELECTORS.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }
    finish();
  }, [stepIndex, finish]);

  if (!meQ.data || meQ.isLoading || onboardingDone) return null;

  const idx = Math.min(Math.max(0, stepIndex), STEP_COPY.length - 1);
  const copy = STEP_COPY[idx]!;
  const isLast = idx >= STEP_SELECTORS.length - 1;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      {!hole ? (
        <div className="absolute inset-0 bg-black/75" aria-hidden />
      ) : (
        <>
          <div
            className="absolute bg-black/75"
            style={{ top: 0, left: 0, right: 0, height: Math.max(0, hole.top) }}
            aria-hidden
          />
          <div
            className="absolute bg-black/75"
            style={{
              top: hole.top,
              left: 0,
              width: Math.max(0, hole.left),
              height: hole.height,
            }}
            aria-hidden
          />
          <div
            className="absolute bg-black/75"
            style={{
              top: hole.top,
              left: hole.left + hole.width,
              right: 0,
              height: hole.height,
            }}
            aria-hidden
          />
          <div
            className="absolute bg-black/75"
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
            disabled={finishMutation.isPending}
            className="btn-press rounded-sm border border-border-subtle px-3 py-1.5 text-xs font-medium text-fg-secondary hover:text-fg-primary disabled:opacity-50"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => onNext()}
            disabled={finishMutation.isPending}
            className="btn-press rounded-sm bg-accent-primary px-3 py-1.5 text-xs font-medium text-fg-inverse hover:bg-accent-glow disabled:opacity-50"
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
