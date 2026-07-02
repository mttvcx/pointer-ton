'use client';

import { createPortal } from 'react-dom';
import { CloseButton } from '@/components/ui/CloseButton';
import type { PredictionMarket } from '@/lib/predictions/marketsDemo';
import { PredictionMarketIcon } from '@/components/predictions/PredictionMarketIcon';
import { PredictionTradeForm } from '@/components/predictions/PredictionTradeForm';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { cn } from '@/lib/utils/cn';

export function PredictionQuickTradeModal({
  market,
  initialOutcome,
  onClose,
}: {
  market: PredictionMarket;
  initialOutcome: 'yes' | 'no';
  onClose: () => void;
}) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className={cn('fixed inset-0 flex items-center justify-center p-4', Z_APP_MODAL_OVERLAY)}>
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prediction-quick-trade-title"
        className="relative w-full max-w-md overflow-hidden rounded-md border border-border-subtle bg-bg-raised shadow-xl"
      >
        <div className="flex items-start gap-3 border-b border-border-subtle/60 px-4 py-3">
          <PredictionMarketIcon market={market} size="sm" />
          <div className="min-w-0 flex-1">
            <h2 id="prediction-quick-trade-title" className="text-[13px] font-semibold leading-snug text-fg-primary">
              {market.title}
            </h2>
            {market.outcomeLabel ? (
              <p className="mt-0.5 text-[11px] text-fg-muted">{market.outcomeLabel}</p>
            ) : null}
          </div>
          <CloseButton onClick={onClose} label="Close" />
        </div>
        <PredictionTradeForm
          key={`${market.id}-${initialOutcome}`}
          market={market}
          initialOutcome={initialOutcome}
          showStats={false}
        />
      </div>
    </div>,
    document.body,
  );
}
