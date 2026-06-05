'use client';

import { useRouter } from 'next/navigation';
import type { AppChainId } from '@/lib/chains/appChain';
import {
  CHAIN_DROPDOWN_LABEL,
  CHAIN_ICON_PNG,
  ORDERED_CHAINS,
} from '@/lib/chains/chainAssets';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';

/**
 * Axiom-style chain icons beside Pulse | Stocks — icon-only, active = soft circular highlight.
 */
export function PulseChainSelector({ className }: { className?: string }) {
  const router = useRouter();
  const activeChain = useUIStore((s) => s.activeChain);
  const setActiveChain = useUIStore((s) => s.setActiveChain);

  return (
    <div
      role="listbox"
      aria-label="Pulse network"
      className={cn('flex shrink-0 items-center gap-0.5 sm:gap-1', className)}
    >
      {ORDERED_CHAINS.map((id: AppChainId) => {
        const on = id === activeChain;
        return (
          <button
            key={id}
            type="button"
            role="option"
            aria-selected={on}
            aria-label={CHAIN_DROPDOWN_LABEL[id]}
            title={CHAIN_DROPDOWN_LABEL[id]}
            onClick={() => {
              if (id === activeChain) return;
              setActiveChain(id);
              router.push('/pulse');
            }}
            className={cn(
              'flex shrink-0 items-center justify-center rounded-full transition-all duration-200',
              on ? 'h-7 w-7 bg-white/[0.1]' : 'h-6 w-6 hover:bg-white/[0.05]',
            )}
          >
            <img
              src={CHAIN_ICON_PNG[id]}
              alt=""
              width={on ? 18 : 14}
              height={on ? 18 : 14}
              decoding="async"
              className={cn(
                'object-contain transition-all duration-200',
                on ? 'h-[18px] w-[18px] opacity-100' : 'h-[14px] w-[14px] opacity-40 hover:opacity-65',
              )}
              draggable={false}
            />
          </button>
        );
      })}
    </div>
  );
}
