'use client';

import { HelpCircle } from 'lucide-react';
import { CloseButton } from '@/components/ui/CloseButton';
import { cn } from '@/lib/utils/cn';
import { usePredictionsTourOptional } from '@/components/predictions/PredictionsTourContext';

type PredictionsHelpButtonProps = {
  className?: string;
};

export function PredictionsHelpButton({ className }: PredictionsHelpButtonProps) {
  const tour = usePredictionsTourOptional();
  if (!tour || tour.prefs.dismissedForever) return null;

  const { hintVisible, dismissHint, startTour } = tour;

  return (
    <div className={cn('relative shrink-0', className)}>
      {hintVisible ? (
        <div className="absolute bottom-full right-0 z-10 mb-2 w-[max-content] max-w-[200px] rounded-md border border-border-subtle bg-bg-raised px-3 py-2 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-medium text-fg-primary">Take a tour</p>
            <CloseButton
              onClick={dismissHint}
              label="Dismiss tour hint"
              size="sm"
              className="-mr-1 -mt-0.5"
            />
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={startTour}
        className="btn-press flex h-8 w-8 items-center justify-center rounded-full border border-border-subtle/70 bg-bg-hover/40 text-fg-secondary transition hover:border-border-subtle hover:text-fg-primary"
        aria-label="Start Kalshi predictions tour"
        data-predictions-tour="help"
      >
        <HelpCircle className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
