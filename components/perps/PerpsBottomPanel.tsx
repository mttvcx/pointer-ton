'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

const TABS = ['Positions', 'Open orders', 'Trades'] as const;

const POSITION_COLS = [
  'Coin',
  'Size',
  'Position value',
  'Entry',
  'Mark',
  'Liq. price',
  'Margin',
  'PnL',
  'Close',
] as const;

export function PerpsBottomPanel() {
  const [tab, setTab] = useState(0);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden border-t border-border-subtle bg-bg-raised">
      <div className="flex shrink-0 gap-0.5 border-b border-border-subtle px-2 py-1">
        {TABS.map((name, i) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(i)}
            className={cn(
              'rounded px-3 py-1 text-[11px] font-semibold transition-colors',
              tab === i
                ? 'bg-accent-primary/15 text-accent-glow ring-1 ring-accent-primary/30'
                : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="hidden shrink-0 grid-cols-[repeat(9,minmax(0,1fr))] gap-2 border-b border-border-subtle/80 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-fg-muted md:grid">
        {POSITION_COLS.map((c) => (
          <span key={c} className={c === 'Close' ? 'text-right' : undefined}>
            {c}
          </span>
        ))}
      </div>

      <div className="flex min-h-[5rem] flex-1 items-center justify-center px-4 py-6">
        <div className="text-center">
          <p className="text-[12px] font-semibold text-fg-secondary">No open {TABS[tab]!.toLowerCase()}</p>
          <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-fg-muted">
            {tab === 0
              ? 'Connect your Hyperliquid wallet to view live positions.'
              : tab === 1
                ? 'Resting orders appear here after you submit trades.'
                : 'Fill history syncs from Hyperliquid once trading is enabled.'}
          </p>
        </div>
      </div>
    </div>
  );
}
