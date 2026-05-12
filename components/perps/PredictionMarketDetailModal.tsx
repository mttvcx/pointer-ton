'use client';

import { GlassModal } from '@/components/ui/GlassModal';
import type { PredictionMarketDemo } from '@/lib/perps/predictionMarketsDemo';
import { noPct } from '@/lib/perps/predictionMarketsDemo';
import { PredictionMarketBadge } from '@/components/perps/PredictionMarketBadge';
import { PredictionMarketMiniChart } from '@/components/perps/PredictionMarketMiniChart';

export function PredictionMarketDetailModal({
  open,
  market,
  onClose,
}: {
  open: boolean;
  market: PredictionMarketDemo | null;
  onClose: () => void;
}) {
  if (!market) return null;
  const n = noPct(market.yesPct);

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      maxWidthClass="max-w-md"
      title={
        <span className="flex flex-wrap items-center gap-2 pr-8">
          <span className="text-[14px] font-semibold leading-snug">{market.title}</span>
          <PredictionMarketBadge category={market.category} />
        </span>
      }
      description={
        <p className="text-[11px] leading-snug text-fg-secondary">
          Demo preview — odds are illustrative only. Integration with Polymarket or other venues ships later;
          quotes here are not tradable inside Pointer yet.
        </p>
      }
    >
      <div className="space-y-4 px-4 py-4">
        <div className="flex items-end justify-between gap-4">
          <div className="tabular-nums">
            <div className="text-[10px] font-medium tracking-tight text-fg-muted">Implied YES</div>
            <div className="text-[26px] font-semibold tracking-tight text-signal-bull">{market.yesPct}%</div>
          </div>
          <div className="tabular-nums text-right">
            <div className="text-[10px] font-medium tracking-tight text-fg-muted">Implied NO</div>
            <div className="text-[26px] font-semibold tracking-tight text-signal-bear">{n}%</div>
          </div>
        </div>
        <div className="flex justify-center rounded-md border border-white/[0.06] bg-black/20 py-2">
          <PredictionMarketMiniChart values={market.spark} emphasize className="opacity-100" />
        </div>
        {(market.volumeUsdM != null || market.openInterestUsdM != null) ? (
          <div className="flex flex-wrap gap-4 border-t border-white/[0.06] pt-3 text-[11px] tabular-nums text-fg-secondary">
            {market.volumeUsdM != null ? <span>24h volume ~${market.volumeUsdM.toFixed(1)}m</span> : null}
            {market.openInterestUsdM != null ? (
              <span>Open interest ~${market.openInterestUsdM.toFixed(1)}m</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </GlassModal>
  );
}
