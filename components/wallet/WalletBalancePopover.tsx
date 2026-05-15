'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, ArrowUpToLine, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUIStore } from '@/store/ui';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { cn } from '@/lib/utils/cn';
import { formatNumber, formatUsd } from '@/lib/utils/formatters';
import { useOverlayPresence, POPOVER_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { popoverPanelClasses } from '@/lib/ui/overlayMotion';

type AssetPill = 'sol' | 'usdc' | 'usol';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  totalUsd: number | null;
  solUi: number | null;
  usdcUi: number | null;
  onDeposit: () => void;
  /** False when no row is selected for the current header chain */
  hasActiveWallet?: boolean;
};

/**
 * Axiom-style compact balance popover (multi-chain header).
 */
export function WalletBalancePopover({
  open,
  onOpenChange,
  anchorRef,
  totalUsd,
  solUi,
  usdcUi,
  onDeposit,
  hasActiveWallet = true,
}: Props) {
  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);
  const popRef = useRef<HTMLDivElement>(null);
  const { mounted, visible } = useOverlayPresence(open, POPOVER_ANIM_CLOSE_MS);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const [asset, setAsset] = useState<AssetPill>('sol');

  function updatePosition() {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  }

  useLayoutEffect(() => {
    if (!mounted || !visible) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [mounted, visible, anchorRef]);

  useEffect(() => {
    if (!mounted) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onOpenChange(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [mounted, onOpenChange, anchorRef]);

  if (!mounted) return null;

  return (
    <div
      ref={popRef}
      className={cn(
        'fixed z-[200] w-[min(calc(100vw-16px),19rem)] rounded-lg border border-border-subtle bg-bg-raised p-2.5 font-sans shadow-2xl',
        popoverPanelClasses(visible),
      )}
      style={{ top: pos.top, right: pos.right }}
      role="dialog"
      aria-label="Wallet balance"
    >
      {!hasActiveWallet ? (
        <div className="mb-2 rounded-md border border-signal-warn/30 bg-signal-warn/10 px-2 py-1.5 text-[11px] leading-snug text-signal-warn">
          No active <span className="font-semibold text-fg-primary">{nativeSym}</span> wallet for this chain.{' '}
          <Link
            href="/wallets"
            onClick={() => onOpenChange(false)}
            className="font-semibold text-accent-primary hover:underline"
          >
            Open Wallets
          </Link>{' '}
          to add one.
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">Total Value</div>
          <div className="mt-0.5 text-[20px] font-semibold tabular-nums text-fg-primary">
            {totalUsd != null && totalUsd > 0 ? formatUsd(totalUsd, { decimals: 2 }) : '$0.00'}
          </div>
        </div>
        <div className="flex gap-1 text-[10px] font-semibold text-fg-muted">
          <span className="text-fg-primary">{nativeSym}</span>
          <span className="text-border-strong">|</span>
          <span className="cursor-not-allowed opacity-70">Perps</span>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1">
        {(['sol', 'usdc', 'usol'] as const).map((pill) => (
          <button
            key={pill}
            type="button"
            onClick={() => {
              if (pill === 'usol') {
                toast.message(activeChain === 'ton' ? 'wTON' : 'wSOL', {
                  description: 'Liquid staking view is not wired yet.',
                });
                setAsset('usol');
                return;
              }
              setAsset(pill);
            }}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition',
              asset === pill
                ? 'border-accent-primary/50 bg-accent-primary/25 text-fg-primary'
                : 'border-border-subtle bg-bg-base text-fg-secondary hover:border-border-default',
            )}
          >
            <span
              className={cn(
                'h-3 w-3 rounded-full',
                pill === 'sol' && 'bg-[#9945FF]/80',
                pill === 'usdc' && 'bg-[#2775ca]',
                pill === 'usol' && 'bg-[#14f195]/70',
              )}
              aria-hidden
            />
            {pill === 'sol' ? nativeSym : pill === 'usdc' ? 'USDC' : activeChain === 'ton' ? 'wTON' : 'wSOL'}
          </button>
        ))}
        <Link
          href="/wallets"
          onClick={() => onOpenChange(false)}
          className="ml-auto rounded p-1 text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary"
          aria-label="Wallet settings"
        >
          <Settings2 className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>

      <div className="mt-2 space-y-1.5">
        {(asset === 'sol' || asset === 'usol') && (
          <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-base px-2 py-1.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#9945FF]/25 text-[10px] font-semibold text-[#e9d5ff]">
              S
            </span>
            <span className="min-w-0 flex-1 tabular-nums text-[12px] font-semibold text-fg-primary">
              {solUi != null ? formatNumber(solUi, { decimals: solUi > 0 && solUi < 0.01 ? 6 : 4 }) : '0'}
            </span>
          </div>
        )}
        {(asset === 'usdc' || asset === 'sol') && (
          <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-base px-2 py-1.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2775ca]/30 text-[9px] font-semibold text-[#93c5fd]">
              U
            </span>
            <span className="flex-1 tabular-nums text-[12px] font-semibold text-fg-primary">
              {usdcUi != null ? formatNumber(usdcUi, { decimals: 4 }) : '0'}
            </span>
          </div>
        )}
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            onDeposit();
          }}
          className="btn-press rounded-md bg-accent-primary py-2 text-[11px] font-semibold text-fg-inverse transition hover:brightness-110"
        >
          <span className="inline-flex items-center justify-center gap-1">
            <ArrowDownToLine className="h-3.5 w-3.5" strokeWidth={2.25} />
            Deposit
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            toast.message('Withdraw', {
              description: `Send ${nativeSym} or other tokens from your wallet using any self-custody wallet app.`,
            });
          }}
          className="btn-press rounded-md border border-border-subtle bg-bg-hover py-2 text-[11px] font-semibold text-fg-primary transition hover:bg-bg-sunken"
        >
          <span className="inline-flex items-center justify-center gap-1">
            <ArrowUpToLine className="h-3.5 w-3.5" strokeWidth={2.25} />
            Withdraw
          </span>
        </button>
      </div>
    </div>
  );
}
