'use client';

import { toast } from 'sonner';
import type { AppChainId } from '@/lib/chains/appChain';
import { APP_CHAIN_IDS } from '@/lib/chains/appChain';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';

const CHAIN_SRC: Record<AppChainId, string> = {
  ton: '/chains/ton.svg',
  sol: '/chains/sol.svg',
  bnb: '/chains/bnb.svg',
  base: '/chains/base.svg',
};

const CHAIN_LABEL: Record<AppChainId, string> = {
  ton: 'The Open Network',
  sol: 'Solana',
  bnb: 'BNB Chain',
  base: 'Base',
};

const SIZE_PX = { sm: 22, md: 26 } as const;

export function ChainIconToggle({
  className,
  size = 'md',
}: {
  className?: string;
  size?: keyof typeof SIZE_PX;
}) {
  const activeChain = useUIStore((s) => s.activeChain);
  const setActiveChain = useUIStore((s) => s.setActiveChain);
  const px = SIZE_PX[size];

  return (
    <div
      className={cn('inline-flex items-center gap-0.5', className)}
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
              'relative flex shrink-0 items-center justify-center rounded-full p-0.5 transition-opacity duration-150',
              on
                ? 'opacity-100 ring-1 ring-white/50 ring-offset-0 shadow-[0_0_12px_-4px_rgba(255,255,255,0.3)]'
                : 'opacity-45 hover:opacity-90',
            )}
          >
            <img
              src={CHAIN_SRC[id]}
              alt=""
              width={px}
              height={px}
              className="rounded-full select-none"
              draggable={false}
            />
          </button>
        );
      })}
    </div>
  );
}
