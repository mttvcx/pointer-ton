'use client';

import { DEMO_SENTIMENT_SUMMARY } from '@/lib/perps/predictionMarketsDemo';
import { PolymarketWordmark } from '@/components/perps/PolymarketWordmark';
import { cn } from '@/lib/utils/cn';

export function PredictionMarketSidebar({ className }: { className?: string }) {
  const s = DEMO_SENTIMENT_SUMMARY;
  return (
    <aside
      className={cn(
        'overflow-hidden bg-[#080c12]',
        className,
      )}
    >
      <div className="border-b border-white/[0.05] px-2.5 py-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-[11px] font-semibold tracking-tight text-fg-primary">Market sentiment</h3>
          <PolymarketWordmark size="sm" />
        </div>
        <p className="mt-1 text-[9px] leading-relaxed text-fg-muted">
          Aggregated probabilities from thematic markets · not tradable routing.
        </p>
      </div>
      <ul className="divide-y divide-white/[0.045] px-2.5 py-1">
        {s.lines.map((line) => (
          <li key={line.label} className="flex items-start justify-between gap-4 py-2 first:pt-1.5">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold tracking-tight text-fg-secondary">{line.label}</div>
              {line.hint ? (
                <p className="mt-0.5 text-[9px] leading-snug text-fg-muted/90">{line.hint}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right tabular-nums">
              <div className="text-[12px] font-semibold tracking-tight text-accent-glow">{line.value}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-start justify-between gap-3 border-t border-white/[0.05] bg-black/20 px-2.5 py-2">
        <span className="text-[10px] font-semibold text-fg-secondary">Crowd positioning</span>
        <span className="rounded bg-accent-primary/12 px-2 py-0.5 text-[11px] font-semibold tracking-tight text-accent-glow ring-1 ring-accent-primary/25">
          {s.crowdPositioning}
        </span>
      </div>
    </aside>
  );
}
