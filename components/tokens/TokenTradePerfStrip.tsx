'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  formatTradePerfPct,
  TOKEN_TRADE_PERF_TFS,
  type TokenTradePerfTf,
} from '@/lib/tokens/tokenTradePerfTfs';

/** Axiom-style 5m / 1h / 6h / 24h strip above the buy panel toggle. */
export function TokenTradePerfStrip({
  changes,
  selected,
  onSelect,
}: {
  changes: Record<TokenTradePerfTf, number | null>;
  selected: TokenTradePerfTf;
  onSelect: (tf: TokenTradePerfTf) => void;
}) {
  const [hovered, setHovered] = useState<TokenTradePerfTf | null>(null);

  return (
    <div className="grid grid-cols-4 gap-px rounded-md bg-border-subtle/25 p-px">
      {TOKEN_TRADE_PERF_TFS.map((tf) => {
        const pct = changes[tf];
        const isSelected = selected === tf;
        const isHovered = hovered === tf;
        const showPct = (isSelected || isHovered) && pct != null;
        const pos = (pct ?? 0) >= 0;

        return (
          <button
            key={tf}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(tf)}
            onMouseEnter={() => setHovered(tf)}
            onMouseLeave={() => setHovered(null)}
            className={cn(
              'focus-ring flex min-h-[2.35rem] flex-col items-center justify-center rounded-[5px] px-1 py-1.5',
              'transition-colors duration-150',
              isSelected
                ? 'bg-bg-hover text-fg-primary'
                : 'bg-bg-raised text-fg-muted hover:bg-bg-hover/70 hover:text-fg-secondary',
            )}
          >
            <span className="text-[11px] font-semibold leading-none">{tf}</span>
            <span
              className={cn(
                'mt-0.5 h-[12px] text-[10px] font-medium tabular-nums leading-none',
                showPct
                  ? pos
                    ? 'text-signal-bull'
                    : 'text-signal-bear'
                  : 'invisible',
              )}
              aria-hidden={!showPct}
            >
              {formatTradePerfPct(pct)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
