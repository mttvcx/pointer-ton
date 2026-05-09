'use client';

import { toast } from 'sonner';
import type { AppChainId } from '@/lib/chains/appChain';
import { APP_CHAIN_IDS } from '@/lib/chains/appChain';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';

/** Transparent PNGs in `public/chains/` — swap files to match your brand kit (no code changes). */
const CHAIN_SRC: Record<AppChainId, string> = {
  sol: '/chains/sol.png',
  bnb: '/chains/bnb.png',
  base: '/chains/base.png',
  ton: '/chains/ton.png',
};

const CHAIN_LABEL: Record<AppChainId, string> = {
  ton: 'The Open Network',
  sol: 'Solana',
  bnb: 'BNB Chain',
  base: 'Base',
};

const SIZE_CLASS = { sm: 'h-5 w-5', md: 'h-6 w-6' } as const;

export function ChainIconToggle({
  className,
  size = 'md',
}: {
  className?: string;
  size?: keyof typeof SIZE_CLASS;
}) {
  const activeChain = useUIStore((s) => s.activeChain);
  const setActiveChain = useUIStore((s) => s.setActiveChain);
  const dim = SIZE_CLASS[size];

  return (
    <div
      className={cn('inline-flex items-center gap-1.5', className)}
      role="radiogroup"
      aria-label="Network"
    >
      {APP_CHAIN_IDS.map((id) => {
        const on = activeChain === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            title={CHAIN_LABEL[id]}
            onClick={() => {
              setActiveChain(id);
              if (id !== 'ton') {
                toast.message(`${CHAIN_LABEL[id]} preview`, {
                  description: 'Pointer Pulse and wallets are live on TON first — other networks switch UI only for now.',
                  duration: 4200,
                });
              }
            }}
            className={cn(
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2]/55 focus-visible:ring-offset-0',
              'flex shrink-0 items-center justify-center rounded-md p-0.5 transition-[opacity,filter,transform] duration-150',
              on
                ? 'opacity-100 brightness-110 saturate-[1.05]'
                : 'opacity-[0.42] hover:opacity-[0.78]',
            )}
          >
            <img
              src={CHAIN_SRC[id]}
              alt=""
              className={cn('block select-none object-contain', dim)}
              draggable={false}
            />
          </button>
        );
      })}
    </div>
  );
}
