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
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors duration-150',
              on ? 'bg-white/[0.1]' : 'hover:bg-white/[0.06]',
            )}
          >
            <img
              src={CHAIN_ICON_PNG[id]}
              alt=""
              width={18}
              height={18}
              decoding="async"
              className="h-[18px] w-[18px] object-contain"
              draggable={false}
            />
          </button>
        );
      })}
    </div>
  );
}
