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
const DEPOSIT_BLUE = '#4f8ff7';

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
            'focus-ring flex h-8 items-center rounded-full border border-border-subtle bg-bg-base px-2 transition-colors hover:border-white/[0.12] hover:bg-bg-hover/40',
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
        className="flex w-[248px] flex-col gap-2 rounded-xl border border-border-subtle bg-bg-base p-2.5 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.85)]"
      >
        {!hasActiveWallet ? (
          <div className="rounded-lg border border-amber-400/15 bg-amber-400/[0.06] px-2 py-1.5 text-[10px] leading-snug text-amber-200/80">
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

        <div>
          <div className="text-[10px] font-medium text-fg-muted">Total Value</div>
          <div className="text-[20px] font-medium leading-tight tabular-nums text-fg-primary">
            {totalUsd != null && totalUsd > 0 ? formatUsd(totalUsd, { decimals: 2 }) : '$0.00'}
          </div>
          {walletAddress ? (
            <div className="mt-0.5 flex items-center gap-0.5">
              <span className="font-mono text-[10px] text-fg-muted">
                {shortenAddress(walletAddress)}
              </span>
              <CopyButton
                value={walletAddress}
                toastLabel="Address copied"
                iconOnly
                iconClassName="h-2.5 w-2.5 rounded p-0 text-fg-muted hover:text-fg-secondary"
                label="Copy wallet address"
              />
            </div>
          ) : null}
        </div>

        {showSpendAssetTabs ? (
          <div className="flex items-center gap-1">
            <div className="flex min-w-0 flex-1 items-center gap-0.5 rounded-full bg-bg-sunken/80 p-0.5">
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
                      'min-w-0 flex-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors',
                      active
                        ? 'bg-[#4f8ff7] text-white'
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
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-secondary"
              onClick={() => setOpen(false)}
            >
              <Settings className="h-3 w-3" strokeWidth={2} aria-hidden />
            </Link>
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2 rounded-full bg-bg-sunken/70 px-2.5 py-1.5">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <img
                src={CHAIN_ICON_PNG[activeChain]}
                alt=""
                className="h-4 w-4 shrink-0 rounded-full object-contain"
                draggable={false}
                aria-hidden
              />
              <TerminalNativeBalance
                amount={solAmount}
                className="text-[12px] font-medium tabular-nums text-fg-primary"
              />
            </span>
          </div>
          {showSpendAssetTabs ? (
            <div className="flex items-center justify-between gap-2 rounded-full bg-bg-sunken/70 px-2.5 py-1.5">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <img
                  src={USDC_ICON}
                  alt=""
                  className="h-4 w-4 shrink-0 rounded-full object-contain"
                  draggable={false}
                  aria-hidden
                />
                <span className="text-[12px] font-medium tabular-nums text-fg-primary">
                  {formatUsdcAmount(usdcAmount)}
                </span>
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={handleDeposit}
            className="btn-press flex flex-1 items-center justify-center gap-1 rounded-full py-2 text-[11px] font-semibold text-white transition-colors hover:brightness-110"
            style={{ backgroundColor: DEPOSIT_BLUE }}
          >
            <ArrowDownToLine className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
            Deposit
          </button>
          <button
            type="button"
            onClick={handleWithdraw}
            className="btn-press flex flex-1 items-center justify-center gap-1 rounded-full border border-border-subtle bg-bg-sunken/80 py-2 text-[11px] font-semibold text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary"
          >
            <ArrowUpToLine className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
            Withdraw
          </button>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
