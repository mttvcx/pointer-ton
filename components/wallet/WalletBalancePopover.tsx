'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, ArrowUpToLine, ChevronDown } from 'lucide-react';
import { CopyButton } from '@/components/shared/CopyButton';
import { Popover } from '@/components/ui/popover';
import { useUIStore } from '@/store/ui';
import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_ICON_PNG, CHAIN_TICKER } from '@/lib/chains/chainAssets';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { formatSol, formatUsd } from '@/lib/utils/formatters';
import type { SolSpendAsset } from '@/lib/trading/spendAsset';

export type WalletSpendAssetTab = SolSpendAsset | 'usol';

export type WalletPopoverBalanceRow = {
  symbol: string;
  amount: number | null;
  /** Icon source (chain logo by default). Override for USDC / uSOL once those land. */
  iconSrc?: string;
  chainId?: AppChainId;
};

type Props = {
  totalUsd: number | null;
  nativeBalance: number | null;
  walletAddress?: string | null;
  /** Extra chain/asset pills (extend with USDC / uSOL later). */
  balances?: WalletPopoverBalanceRow[];
  onDeposit: () => void;
  onWithdraw: () => void;
  /** False when no row is selected for the current header chain */
  hasActiveWallet?: boolean;
  /** Solana spend-asset tabs (SOL / USDC / uSOL). */
  spendAsset?: WalletSpendAssetTab;
  onSpendAssetChange?: (asset: SolSpendAsset) => void;
  showSpendAssetTabs?: boolean;
  className?: string;
};

function ChainLogo({ chain, className }: { chain: AppChainId; className: string }) {
  return (
    <img
      src={CHAIN_ICON_PNG[chain]}
      alt=""
      draggable={false}
      className={cn('shrink-0 object-contain', className)}
      aria-hidden
    />
  );
}

/**
 * Unified top-nav wallet trigger + Pulse-style balance popover (deposit / withdraw).
 * Icon follows the active chain (`CHAIN_ICON_PNG[activeChain]`).
 * Uses Radix-compatible {@link Popover} primitives (align end, sideOffset 8).
 */
export function WalletBalancePopover({
  totalUsd,
  nativeBalance,
  walletAddress,
  balances,
  onDeposit,
  onWithdraw,
  hasActiveWallet = true,
  spendAsset = 'sol',
  onSpendAssetChange,
  showSpendAssetTabs = false,
  className,
}: Props) {
  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);
  const chainTicker = CHAIN_TICKER[activeChain];
  const [open, setOpen] = useState(false);

  const solRow = balances?.find((b) => b.symbol === chainTicker || b.symbol === 'SOL');
  const usdcRow = balances?.find((b) => b.symbol === 'USDC');
  const solAmount = solRow?.amount ?? nativeBalance ?? 0;
  const usdcAmount = usdcRow?.amount ?? 0;
  const triggerAmount =
    showSpendAssetTabs && spendAsset === 'usdc'
      ? formatSol(usdcAmount)
      : formatSol(solAmount);

  const chainPills = useMemo(() => {
    if (balances?.length) {
      return balances.map((row) => ({
        key: row.symbol,
        symbol: row.symbol,
        amount: row.amount ?? 0,
        iconSrc: row.iconSrc,
        chainId: row.chainId ?? activeChain,
      }));
    }
    return [
      {
        key: chainTicker,
        symbol: chainTicker,
        amount: solAmount,
        iconSrc: undefined as string | undefined,
        chainId: activeChain,
      },
    ];
  }, [balances, chainTicker, solAmount, activeChain]);

  function handleDeposit() {
    setOpen(false);
    onDeposit();
  }

  function handleWithdraw() {
    setOpen(false);
    onWithdraw();
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          title="Wallet"
          className={cn(
            'focus-ring flex h-9 items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.04] px-3 transition-colors hover:bg-white/[0.06]',
            className,
          )}
        >
          <ChainLogo chain={activeChain} className="h-5 w-5" />
          <span className="text-[13px] font-medium tabular-nums text-white">{triggerAmount}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/40" strokeWidth={2} aria-hidden />
        </button>
      </Popover.Trigger>

      <Popover.Content
        align="end"
        sideOffset={8}
        className="flex w-[280px] flex-col gap-3 rounded-xl border border-white/[0.06] bg-[#0a0a0a] p-3 shadow-2xl shadow-black/60"
      >
        {!hasActiveWallet ? (
          <div className="rounded-md border border-amber-400/25 bg-amber-400/10 px-2.5 py-2 text-[11px] leading-snug text-amber-200/90">
            No active <span className="font-semibold text-white">{nativeSym}</span> wallet for this
            chain.{' '}
            <Link
              href="/wallets"
              className="font-semibold text-[#7c5cff] hover:underline"
              onClick={() => setOpen(false)}
            >
              Open Wallets
            </Link>{' '}
            to add one.
          </div>
        ) : null}

        <div>
          <div className="flex items-start justify-between gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
              Total Value
            </span>
            {showSpendAssetTabs ? (
              <div className="flex items-center gap-1">
                {(
                  [
                    ['sol', chainTicker],
                    ['usdc', 'USDC'],
                    ['usol', 'uSOL'],
                  ] as const
                ).map(([id, label]) => {
                  const disabled = id === 'usol';
                  const active = spendAsset === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={disabled}
                      title={
                        disabled
                          ? 'Coming soon'
                          : id === 'usdc'
                            ? 'Trading with USDC'
                            : undefined
                      }
                      onClick={() => {
                        if (disabled || !onSpendAssetChange) return;
                        onSpendAssetChange(id);
                      }}
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-semibold transition',
                        active ? 'bg-[#7c5cff]/25 text-white' : 'text-white/45 hover:text-white/70',
                        disabled && 'cursor-not-allowed opacity-40',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="text-[11px] text-white/60" title="Perps (coming soon)">
                {chainTicker}
              </span>
            )}
          </div>
          <div className="text-[22px] font-medium tabular-nums text-white">
            {totalUsd != null && totalUsd > 0 ? formatUsd(totalUsd, { decimals: 2 }) : '$0.00'}
          </div>
          {walletAddress ? (
            <div className="mt-0.5 flex items-center gap-1">
              <span className="font-mono text-[11px] text-white/40">
                {shortenAddress(walletAddress)}
              </span>
              <CopyButton
                value={walletAddress}
                toastLabel="Address copied"
                iconOnly
                iconClassName="h-3 w-3 rounded p-0 text-white/30 hover:text-white/70"
                label="Copy wallet address"
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          {chainPills.map((pill) => (
            <div
              key={pill.key}
              className="flex w-full items-center justify-between gap-2 rounded-full bg-white/[0.06] px-3 py-2 text-[11px] font-medium text-white"
            >
              <span className="inline-flex min-w-0 items-center gap-1.5">
                {pill.iconSrc ? (
                  <img
                    src={pill.iconSrc}
                    alt=""
                    className="h-3.5 w-3.5 shrink-0 object-contain"
                    draggable={false}
                    aria-hidden
                  />
                ) : (
                  <ChainLogo chain={pill.chainId} className="h-3.5 w-3.5" />
                )}
                {pill.symbol}
              </span>
              <span className="ml-auto shrink-0 tabular-nums text-white/60">
                {formatSol(pill.amount)}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 border-t border-white/[0.04] pt-3">
          <button
            type="button"
            onClick={handleDeposit}
            className="btn-press flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#7c5cff] py-2.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#8a6dff]"
          >
            <ArrowDownToLine className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
            Deposit
          </button>
          <button
            type="button"
            onClick={handleWithdraw}
            className="btn-press flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/[0.06] py-2.5 text-[12.5px] font-medium text-white transition-colors hover:bg-white/[0.08]"
          >
            <ArrowUpToLine className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
            Withdraw
          </button>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
