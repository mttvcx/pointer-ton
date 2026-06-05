'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_DROPDOWN_LABEL, CHAIN_ICON_PNG, CHAIN_TICKER, ORDERED_CHAINS } from '@/lib/chains/chainAssets';
import { useOverlayPresence, POPOVER_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { popoverPanelClasses } from '@/lib/ui/overlayMotion';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';

type Variant = 'default' | 'topbarIntegrated';

/**
 * Axiom-style chain control: compact pill with logo (+ optional ticker) + chevron, rounded menu.
 */
export function ChainSelectDropdown({
  className,
  variant = 'default',
  triggerClassName,
  menuAlign = 'right',
  /** When false, only the chain icon + chevron show (balance uses the icon as the chain label). */
  showTicker = true,
}: {
  className?: string;
  /** Merged into the top bar wallet strip — no standalone chrome. */
  variant?: Variant;
  triggerClassName?: string;
  /** Menu alignment relative to the trigger wrapper. */
  menuAlign?: 'left' | 'right';
  showTicker?: boolean;
}) {
  const router = useRouter();
  const activeChain = useUIStore((s) => s.activeChain);
  const setActiveChain = useUIStore((s) => s.setActiveChain);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { mounted: menuMounted, visible: menuVisible } = useOverlayPresence(open, POPOVER_ANIM_CLOSE_MS);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className={cn('relative', className)} ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        title={showTicker ? undefined : `Network: ${CHAIN_DROPDOWN_LABEL[activeChain]}`}
        className={cn(
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/35',
          variant === 'default' &&
            'inline-flex h-8 shrink-0 items-center gap-1 rounded-[10px] bg-[#2a2a2d] px-2.5 text-[12px] font-semibold text-white/90 transition-colors hover:bg-[#333338]',
          variant === 'topbarIntegrated' &&
            cn(
              'inline-flex h-full min-h-0 shrink-0 items-center gap-1 border-0 bg-transparent text-fg-secondary shadow-none ring-0 transition hover:bg-white/[0.04] hover:text-fg-primary',
              showTicker ? 'px-2 text-[11px] font-semibold tracking-wide' : 'pl-1 pr-1.5',
            ),
          triggerClassName,
        )}
      >
        <img
          src={CHAIN_ICON_PNG[activeChain]}
          alt=""
          width={showTicker ? 18 : 15}
          height={showTicker ? 18 : 15}
          decoding="async"
          fetchPriority="high"
          className={cn('object-contain', showTicker ? 'h-[18px] w-[18px]' : 'h-[15px] w-[15px]')}
          draggable={false}
        />
        {showTicker ? (
          <span className="inline-flex items-center gap-0.5 tabular-nums">
            {CHAIN_TICKER[activeChain]}
            <ChevronDown
              className={cn(
                'h-3 w-3 shrink-0 text-fg-muted transition-transform duration-200 ease-out',
                open && 'rotate-180',
              )}
              aria-hidden
            />
          </span>
        ) : (
          <ChevronDown
            className={cn(
              'h-3 w-3 shrink-0 text-fg-muted transition-transform duration-200 ease-out',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        )}
      </button>

      {menuMounted ? (
        <div
          role="listbox"
          aria-label="Select network"
          className={cn(
            'absolute top-[calc(100%+6px)] z-[140] min-w-[12.5rem] overflow-hidden rounded-xl border border-border-subtle bg-bg-raised py-1 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.85)] fill-mode-forwards',
            menuAlign === 'left' ? 'left-0' : 'right-0',
            popoverPanelClasses(menuVisible),
          )}
        >
          {ORDERED_CHAINS.map((id: AppChainId) => {
            const on = id === activeChain;
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => {
                  setActiveChain(id);
                  setOpen(false);
                  router.push('/pulse');
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors',
                  on
                    ? 'bg-white/[0.09] text-fg-primary'
                    : 'text-fg-secondary hover:bg-white/[0.06] hover:text-fg-primary',
                )}
              >
                <img
                  src={CHAIN_ICON_PNG[id]}
                  alt=""
                  width={22}
                  height={22}
                  loading="lazy"
                  decoding="async"
                  className="h-[22px] w-[22px] object-contain"
                  draggable={false}
                />
                <span className="min-w-0 flex-1 font-medium">{CHAIN_DROPDOWN_LABEL[id]}</span>
                <span className="shrink-0 tabular-nums text-[10px] text-fg-muted">{CHAIN_TICKER[id]}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
