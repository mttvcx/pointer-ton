'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, ArrowUpToLine, Settings } from 'lucide-react';
import { CopyButton } from '@/components/shared/CopyButton';
import { Popover } from '@/components/ui/popover';
import { TerminalWalletChip } from '@/components/wallet/TerminalWalletChip';
import { useUIStore } from '@/store/ui';
import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_ICON_PNG, CHAIN_TICKER } from '@/lib/chains/chainAssets';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { formatUsd } from '@/lib/utils/formatters';
import { TerminalNativeBalance } from '@/lib/utils/terminalBalanceFormat';
import type { SolSpendAsset } from '@/lib/trading/spendAsset';

export type WalletSpendAssetTab = SolSpendAsset | 'usol';

export type WalletPopoverBalanceRow = {
  symbol: string;
  amount: number | null;
  iconSrc?: string;
  chainId?: AppChainId;
};

type Props = {
  totalUsd: number | null;
  nativeBalance: number | null;
  walletAddress?: string | null;
  walletCount?: number;
  balances?: WalletPopoverBalanceRow[];
  onDeposit: () => void;
  onWithdraw: () => void;
  hasActiveWallet?: boolean;
  spendAsset?: WalletSpendAssetTab;
  onSpendAssetChange?: (asset: SolSpendAsset) => void;
  showSpendAssetTabs?: boolean;
  className?: string;
};

const USDC_ICON = '/logos/protocols/usdc.png';

function formatUsdcAmount(amount: number): string {
  if (amount === 0) return '0';
  if (amount >= 1) return amount.toFixed(2).replace(/\.?0+$/, '');
  return parseFloat(amount.toPrecision(3)).toString();
}

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

  function handleDeposit() {
    setOpen(false);
    onDeposit();
  }

  function handleWithdraw() {
    setOpen(false);
    onWithdraw();
  }

  const assetTabs = [
    ['sol', chainTicker],
    ['usdc', 'USDC'],
    ['usol', 'uSOL'],
  ] as const;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          title="Wallet"
          className={cn(
            'focus-ring flex h-7 items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-raised px-2 transition-colors hover:bg-bg-hover hover:border-border-default',
            className,
          )}
        >
          <TerminalWalletChip
            nativeBalance={solAmount}
            usdcBalance={showSpendAssetTabs ? usdcAmount : null}
            activeChain={activeChain}
            variant="header"
          />
        </button>
      </Popover.Trigger>

      <Popover.Content
        align="end"
        sideOffset={6}
        className="flex w-[240px] flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-raised p-0 shadow-panel"
      >
        {!hasActiveWallet ? (
          <div className="mx-3 mt-3 rounded-lg border border-amber-400/15 bg-amber-400/[0.06] px-2 py-1.5 text-[10px] leading-snug text-amber-200/80">
            No {nativeSym} wallet.{' '}
            <Link
              href="/wallets"
              className="font-semibold text-[#4f8ff7] hover:underline"
              onClick={() => setOpen(false)}
            >
              Add one
            </Link>
          </div>
        ) : null}

        {/* Header */}
        <div className="px-3 pb-2.5 pt-3">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-widest text-fg-muted">
            Total Value
          </div>
          <div className="text-[26px] font-semibold tabular-nums leading-none text-fg-primary">
            {totalUsd != null && totalUsd > 0 ? formatUsd(totalUsd, { decimals: 2 }) : '$0.00'}
          </div>
          {walletAddress ? (
            <div className="mt-1.5 flex items-center gap-1">
              <span className="font-mono text-[10px] text-fg-muted">
                {shortenAddress(walletAddress)}
              </span>
              <CopyButton
                value={walletAddress}
                toastLabel="Address copied"
                iconOnly
                iconClassName="h-2.5 w-2.5 text-fg-muted hover:text-fg-secondary"
                label="Copy"
              />
            </div>
          ) : null}
        </div>

        <div className="border-t border-border-subtle/40" />

        {/* Asset tabs */}
        {showSpendAssetTabs ? (
          <>
            <div className="flex items-center gap-1.5 px-3 py-2">
              <div className="flex flex-1 items-center gap-0.5 rounded-lg bg-bg-sunken p-0.5">
                {assetTabs.map(([id, label]) => {
                  const disabled = id === 'usol';
                  const active = spendAsset === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={disabled}
                      title={disabled ? 'Coming soon' : undefined}
                      onClick={() => {
                        if (disabled || !onSpendAssetChange) return;
                        onSpendAssetChange(id);
                      }}
                      className={cn(
                        'flex-1 rounded-md py-1 text-[11px] font-semibold transition-colors',
                        active
                          ? 'bg-bg-raised text-fg-primary shadow-sm'
                          : 'text-fg-muted hover:text-fg-secondary',
                        disabled && 'cursor-not-allowed opacity-30',
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <Link
                href="/wallets"
                title="Manage wallets"
                onClick={() => setOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
              >
                <Settings className="h-3 w-3" strokeWidth={2} aria-hidden />
              </Link>
            </div>
            <div className="border-t border-border-subtle/40" />
          </>
        ) : null}

        {/* Balance rows */}
        <div className="flex flex-col gap-2 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <img
              src={CHAIN_ICON_PNG[activeChain]}
              alt=""
              className="h-4 w-4 shrink-0 rounded-full object-contain"
              draggable={false}
              aria-hidden
            />
            <TerminalNativeBalance
              amount={solAmount}
              className="text-[13px] font-medium tabular-nums text-fg-primary"
            />
          </div>
          {showSpendAssetTabs ? (
            <div className="flex items-center gap-2">
              <img
                src={USDC_ICON}
                alt=""
                className="h-4 w-4 shrink-0 rounded-full object-contain"
                draggable={false}
                aria-hidden
              />
              <span className="text-[13px] font-medium tabular-nums text-fg-primary">
                {formatUsdcAmount(usdcAmount)}
              </span>
            </div>
          ) : null}
        </div>

        <div className="border-t border-border-subtle/40" />

        {/* Buttons */}
        <div className="flex gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={handleDeposit}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent-primary py-1.5 text-[12px] font-semibold text-white transition-colors hover:brightness-110"
          >
            <ArrowDownToLine className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
            Deposit
          </button>
          <button
            type="button"
            onClick={handleWithdraw}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-bg-hover py-1.5 text-[12px] font-semibold text-fg-primary transition-colors hover:bg-bg-raised"
          >
            <ArrowUpToLine className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
            Withdraw
          </button>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
