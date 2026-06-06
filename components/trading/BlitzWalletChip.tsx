'use client';

import { useState } from 'react';
import { MousePointer2 } from 'lucide-react';
import type { AppChainId } from '@/lib/chains/appChain';
import { EnableBlitzModal } from '@/components/trading/EnableBlitzModal';
import { useTradingStore } from '@/store/trading';
import { cn } from '@/lib/utils/cn';

type Props = {
  walletAddress: string;
  walletLabel?: string;
  activeChain: AppChainId;
  demoBuyAmount?: number;
  className?: string;
};

/** Per-wallet Blitz toggle (Pointer’s Turbo) — chip in wallet picker rows. */
export function BlitzWalletChip({
  walletAddress,
  walletLabel,
  activeChain,
  demoBuyAmount,
  className,
}: Props) {
  const enabled = useTradingStore((s) => s.blitzWalletAddresses.includes(walletAddress));
  const enableBlitz = useTradingStore((s) => s.enableBlitzWallet);
  const disableBlitz = useTradingStore((s) => s.disableBlitzWallet);
  const [modalOpen, setModalOpen] = useState(false);

  function activate(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    if (enabled) {
      disableBlitz(walletAddress);
      return;
    }
    setModalOpen(true);
  }

  return (
    <>
      {/* span — parent wallet rows are <button>; nested <button> breaks hydration */}
      <span
        role="button"
        tabIndex={0}
        onClick={activate}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          activate(e);
        }}
        title={enabled ? 'Blitz on — click to turn off' : 'Enable Blitz'}
        aria-label={enabled ? 'Blitz on — click to turn off' : 'Enable Blitz'}
        className={cn(
          'inline-flex shrink-0 cursor-pointer items-center gap-0.5 rounded px-1 py-px text-[10px] font-semibold transition',
          enabled
            ? 'text-accent-primary hover:text-accent-primary/80'
            : 'text-fg-muted hover:text-fg-secondary',
          className,
        )}
      >
        <MousePointer2 className="h-3 w-3" strokeWidth={2.25} aria-hidden />
        {enabled ? 'On' : 'Off'}
      </span>

      <EnableBlitzModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onEnable={() => enableBlitz(walletAddress)}
        walletLabel={walletLabel}
        activeChain={activeChain}
        demoBuyAmount={demoBuyAmount}
      />
    </>
  );
}
