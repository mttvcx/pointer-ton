'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, ArrowUpToLine, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUIStore } from '@/store/ui';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { cn } from '@/lib/utils/cn';
import { formatNumber, formatUsd } from '@/lib/utils/formatters';

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
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const [asset, setAsset] = useState<AssetPill>('sol');

  useLayoutEffect(() => {
    if (!open) return;
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (popRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onOpenChange(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onOpenChange, anchorRef]);

  if (!open) return null;

  return (
    <div
      ref={popRef}
      className="fixed z-[95] w-[min(calc(100vw-16px),19rem)] rounded-lg border border-[#1b1f2a] bg-[#12141b] p-2.5 font-sans shadow-2xl"
      style={{ top: pos.top, right: pos.right }}
      role="dialog"
      aria-label="Wallet balance"
    >
      {!hasActiveWallet ? (
        <div className="mb-2 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-100">
          No active <span className="font-semibold">{nativeSym}</span> wallet for this chain.{' '}
          <Link href="/wallets" onClick={() => onOpenChange(false)} className="font-semibold text-[#8da2ff] hover:underline">
            Open Wallets
          </Link>{' '}
          to add one.
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-[#6b7280]">
            Total Value
          </div>
          <div className="mt-0.5 text-[20px] font-semibold tabular-nums text-white">
            {totalUsd != null && totalUsd > 0 ? formatUsd(totalUsd, { decimals: 2 }) : '$0.00'}
          </div>
        </div>
        <div className="flex gap-1 text-[10px] font-semibold text-[#4b5563]">
          <span className="text-white">{nativeSym}</span>
          <span className="text-[#3f4654]">|</span>
          <span className="cursor-not-allowed">Perps</span>
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
                ? 'border-[#5865F2]/50 bg-[#5865F2]/25 text-white'
                : 'border-[#1b1f2a] bg-[#080d14] text-[#d1d5db] hover:border-[#2d3548]',
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
          className="ml-auto rounded p-1 text-[#6b7280] transition hover:bg-white/5 hover:text-white"
          aria-label="Wallet settings"
        >
          <Settings2 className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>

      <div className="mt-2 space-y-1.5">
        {(asset === 'sol' || asset === 'usol') && (
          <div className="flex items-center gap-2 rounded-md border border-[#1b1f2a] bg-[#080d14] px-2 py-1.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#9945FF]/25 text-[10px] font-semibold text-[#e9d5ff]">
              S
            </span>
            <span className="min-w-0 flex-1 tabular-nums text-[12px] font-semibold tabular-nums text-white">
              {solUi != null ? formatNumber(solUi, { decimals: solUi > 0 && solUi < 0.01 ? 6 : 4 }) : '0'}
            </span>
          </div>
        )}
        {(asset === 'usdc' || asset === 'sol') && (
          <div className="flex items-center gap-2 rounded-md border border-[#1b1f2a] bg-[#080d14] px-2 py-1.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2775ca]/30 text-[9px] font-semibold text-[#93c5fd]">
              U
            </span>
            <span className="flex-1 tabular-nums text-[12px] font-semibold tabular-nums text-white">
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
          className="btn-press rounded-md bg-[#5865F2] py-2 text-[11px] font-semibold text-[#0a0a0f] transition hover:brightness-105"
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
          className="btn-press rounded-md border border-[#1b1f2a] bg-[#1b1f2a]/40 py-2 text-[11px] font-semibold text-white transition hover:bg-[#252b38]"
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
