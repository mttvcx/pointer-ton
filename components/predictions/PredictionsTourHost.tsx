'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SpotlightTour, type SpotlightTourStep } from '@/components/onboarding/SpotlightTour';
import {
  PredictionsTourProvider,
  usePredictionsTour,
} from '@/components/predictions/PredictionsTourContext';
import { PREDICTIONS_TOUR_MARKET_ID } from '@/lib/predictions/tourPrefs';
import { modalBtnPrimaryClass, modalBtnSecondaryClass } from '@/lib/ui/modalChrome';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { cn } from '@/lib/utils/cn';

const LIST_STEP_COUNT = 4;

const PREDICTIONS_TOUR_STEPS: SpotlightTourStep[] = [
  {
    selector: '[data-predictions-tour="categories"]',
    title: 'Kalshi categories',
    body: "Browse Crypto, Sports, Politics, and more — filter the desk the same way you'd on a dedicated predictions terminal.",
  },
  {
    selector: '[data-predictions-tour="search"]',
    title: 'Search markets',
    body: 'Find events by title or tag before opening the trading panel.',
  },
  {
    selector: '[data-predictions-tour="controls"]',
    title: 'View & sort',
    body: 'Switch between table and cards, or sort by volume, liquidity, and newest listings.',
  },
  {
    selector: '[data-predictions-tour="markets"]',
    title: 'Market grid',
    body: 'Each row shows live odds, volume, and quick Yes/No pricing. Open any market to trade.',
  },
  {
    selector: '[data-predictions-tour="chart"]',
    title: 'Market overview',
    body: 'Price history and outcome probabilities update as the event approaches resolution.',
  },
  {
    selector: '[data-predictions-tour="trade-panel"]',
    title: 'Yes / No trading',
    body: 'Pick an outcome, set your amount, and submit when Kalshi routing is live.',
  },
  {
    selector: '[data-predictions-tour="pnl-strip"]',
    title: 'Your stats',
    body: 'Track bought, sold, holding, and PnL for this market — same strip as the token desk.',
  },
];

function PredictionsTourExitModal({
  open,
  neverAgain,
  onNeverAgainChange,
  onBack,
  onExit,
}: {
  open: boolean;
  neverAgain: boolean;
  onNeverAgainChange: (checked: boolean) => void;
  onBack: () => void;
  onExit: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className={cn('fixed inset-0 flex items-center justify-center bg-black/60 p-4', Z_APP_MODAL_OVERLAY)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="predictions-tour-exit-title"
    >
      <div className="w-full max-w-md rounded-md border border-border-subtle bg-bg-base p-5 shadow-xl">
        <h2 id="predictions-tour-exit-title" className="text-base font-semibold text-fg-primary">
          Are you sure you want to exit onboarding?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
          You can always replay this tour later from the help button on the predictions page — unless
          you choose not to be asked again.
        </p>
        <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm text-fg-secondary">
          <input
            type="checkbox"
            checked={neverAgain}
            onChange={(e) => onNeverAgainChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded-sm border-border-subtle accent-accent-primary"
          />
          Don&apos;t ask me again
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onBack} className={modalBtnSecondaryClass}>
            Back
          </button>
          <button type="button" onClick={onExit} className={modalBtnPrimaryClass}>
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}

function PredictionsTourRunner() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    tourActive,
    stepIndex,
    setStepIndex,
    stopTour,
    finishTour,
    deskApiRef,
  } = usePredictionsTour();

  const [exitOpen, setExitOpen] = useState(false);
  const [neverAgain, setNeverAgain] = useState(false);

  const onListPage = pathname === '/predictions';
  const onDetailPage = pathname.startsWith('/predictions/');

  useEffect(() => {
    if (!tourActive) return;
    if (stepIndex < LIST_STEP_COUNT && !onListPage) {
      router.replace('/predictions');
    }
  }, [tourActive, stepIndex, onListPage, router]);

  useEffect(() => {
    if (!tourActive || !onListPage) return;
    const api = deskApiRef.current;
    if (!api) return;
    if (stepIndex === 0) api.setDeskCategory('Crypto');
    if (stepIndex === 2) api.setView('table');
    if (stepIndex === 3) {
      api.setDeskCategory('Trending');
      api.setView('table');
    }
  }, [tourActive, stepIndex, onListPage, deskApiRef]);

  useEffect(() => {
    if (!tourActive || !onDetailPage) return;
    if (stepIndex < LIST_STEP_COUNT) {
      router.replace('/predictions');
    }
  }, [tourActive, stepIndex, onDetailPage, router]);

  const openExitConfirm = useCallback(() => {
    setNeverAgain(false);
    setExitOpen(true);
  }, []);

  const onNext = useCallback(() => {
    if (stepIndex < PREDICTIONS_TOUR_STEPS.length - 1) {
      const next = stepIndex + 1;
      if (next === LIST_STEP_COUNT && onListPage) {
        router.push(`/predictions/${encodeURIComponent(PREDICTIONS_TOUR_MARKET_ID)}`);
      }
      setStepIndex(next);
      return;
    }
    finishTour();
  }, [stepIndex, onListPage, router, setStepIndex, finishTour]);

  const confirmExit = useCallback(() => {
    setExitOpen(false);
    stopTour({ neverAgain });
    setNeverAgain(false);
  }, [neverAgain, stopTour]);

  if (!tourActive) {
    return (
      <PredictionsTourExitModal
        open={exitOpen}
        neverAgain={neverAgain}
        onNeverAgainChange={setNeverAgain}
        onBack={() => setExitOpen(false)}
        onExit={confirmExit}
      />
    );
  }

  return (
    <>
      <SpotlightTour
        active={tourActive && !exitOpen}
        stepIndex={stepIndex}
        steps={PREDICTIONS_TOUR_STEPS}
        onNext={onNext}
        onExitRequest={openExitConfirm}
        remeasureKeys={[pathname, onListPage, onDetailPage]}
      />
      <PredictionsTourExitModal
        open={exitOpen}
        neverAgain={neverAgain}
        onNeverAgainChange={setNeverAgain}
        onBack={() => setExitOpen(false)}
        onExit={confirmExit}
      />
    </>
  );
}

export function PredictionsTourHost({ children }: { children: React.ReactNode }) {
  return (
    <PredictionsTourProvider>
      {children}
      <PredictionsTourRunner />
    </PredictionsTourProvider>
  );
}
