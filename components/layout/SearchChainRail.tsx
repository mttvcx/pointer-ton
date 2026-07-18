'use client';

import { ChainIcon } from '@/components/squads/ChainIcon';
import { APP_CHAIN_IDS } from '@/lib/chains/appChain';
import { CHAIN_DROPDOWN_LABEL } from '@/lib/chains/chainAssets';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';

/**
 * Vertical chain switcher on the left edge of the search popup (Axiom-style).
 * Clicking a chain flips the terminal's active chain — the whole surface
 * (feed, quote asset, theme accents) follows, so it "genuinely changes" context.
 */
export function SearchChainRail() {
  const activeChain = useUIStore((s) => s.activeChain);
  const setActiveChain = useUIStore((s) => s.setActiveChain);

  return (
    <div className="flex shrink-0 flex-col items-center gap-1 border-r border-border-subtle bg-bg-sunken/40 px-1.5 py-2.5">
      {APP_CHAIN_IDS.map((id) => {
        const on = id === activeChain;
        return (
          <button
            key={id}
            type="button"
            title={CHAIN_DROPDOWN_LABEL[id]}
            aria-label={`Switch to ${CHAIN_DROPDOWN_LABEL[id]}`}
            aria-pressed={on}
            onClick={() => setActiveChain(id)}
            className={cn(
              'group relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
              on ? 'bg-accent-primary/15' : 'hover:bg-bg-hover',
            )}
          >
            {on ? (
              <span className="absolute -left-1.5 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent-primary" />
            ) : null}
            <ChainIcon
              chain={id}
              size={18}
              className={cn(
                'rounded-full transition',
                on ? 'opacity-100' : 'opacity-50 group-hover:opacity-90',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
