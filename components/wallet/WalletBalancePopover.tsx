'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, ArrowUpToLine, Copy, Settings } from 'lucide-react';
import { Popover } from '@/components/ui/popover';
import { TerminalWalletChip } from '@/components/wallet/TerminalWalletChip';
import { useUIStore } from '@/store/ui';
import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_ICON_PNG, CHAIN_TICKER } from '@/lib/chains/chainAssets';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import {
  AXIOM_DEPOSIT_BTN,
  AXIOM_WALLET_PANEL,
  AXIOM_WALLET_TAB_ACTIVE,
  AXIOM_WALLET_TAB_BTN,
  AXIOM_WALLET_TAB_IDLE,
  AXIOM_WALLET_TAB_TRACK,
  WALLET_TOPBAR_TRIGGER,
  AXIOM_WITHDRAW_BTN,
} from '@/lib/ui/axiomWalletChrome';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { formatUsd } from '@/lib/utils/formatters';
import { TerminalNativeBalance } from '@/lib/utils/terminalBalanceFormat';
import type { SolSpendAsset } from '@/lib/trading/spendAsset';
import { toast } from 'sonner';

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
  onOpenChange?: (open: boolean) => void;
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
  onOpenChange,
}: Props) {
  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);
  const chainTicker = CHAIN_TICKER[activeChain];
  const [open, setOpen] = useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  const solRow = balances?.find((b) => b.symbol === chainTicker || b.symbol === 'SOL');
  const usdcRow = balances?.find((b) => b.symbol === 'USDC');
  const solAmount = solRow?.amount ?? nativeBalance ?? 0;
  const usdcAmount = usdcRow?.amount ?? 0;

  function handleDeposit() {
    handleOpenChange(false);
    onDeposit();
  }

  function handleWithdraw() {
    handleOpenChange(false);
    onWithdraw();
  }

  function copyAddress() {
    if (!walletAddress) return;
    void navigator.clipboard.writeText(walletAddress);
    toast.success('Address copied');
  }

  const assetTabs = [
    { id: 'sol' as const, label: chainTicker, icon: CHAIN_ICON_PNG[activeChain] },
    { id: 'usdc' as const, label: 'USDC', icon: USDC_ICON },
    { id: 'usol' as const, label: 'uSOL', icon: CHAIN_ICON_PNG.sol },
  ];

  const totalDisplay =
    totalUsd != null && Number.isFinite(totalUsd) ? formatUsd(totalUsd, { decimals: 2 }) : '$0.00';

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button type="button" title="Wallet" className={cn(WALLET_TOPBAR_TRIGGER, className)}>
          <TerminalWalletChip
            nativeBalance={solAmount}
            usdcBalance={showSpendAssetTabs ? usdcAmount : null}
            activeChain={activeChain}
            variant="header"
          />
        </button>
      </Popover.Trigger>

      <Popover.Content align="end" sideOffset={8} disableAnimation className={AXIOM_WALLET_PANEL}>
        {!hasActiveWallet ? (
          <div className="mx-3 mt-3 rounded-sm border border-amber-400/20 bg-amber-400/[0.08] px-2.5 py-2 text-[11px] text-amber-100/90">
            No {nativeSym} wallet.{' '}
            <Link
              href="/wallets"
              className="font-semibold text-white hover:underline"
              onClick={() => setOpen(false)}
            >
              Add one
            </Link>
          </div>
        ) : null}

        <div className="px-3 pb-3 pt-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#888892]">
            Total Value
          </p>
          <p className="mt-1 text-[28px] font-semibold leading-none tabular-nums text-white">
            {totalDisplay}
          </p>
          {walletAddress ? (
            <button
              type="button"
              onClick={copyAddress}
              className="mt-2 inline-flex items-center gap-1.5 rounded-sm py-0.5 text-[11px] text-[#888892] transition-colors hover:text-[#c4c4c8]"
            >
              <span className="font-mono">{shortenAddress(walletAddress, 4)}</span>
              <Copy className="h-3 w-3 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>

        {showSpendAssetTabs ? (
          <div className="flex items-center gap-2 px-3 pb-3">
            <div className={AXIOM_WALLET_TAB_TRACK}>
              {assetTabs.map((tab) => {
                const disabled = tab.id === 'usol';
                const active = spendAsset === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={disabled}
                    title={disabled ? 'Coming soon' : undefined}
                    onClick={() => {
                      if (disabled || !onSpendAssetChange) return;
                      onSpendAssetChange(tab.id);
                    }}
                    className={cn(
                      AXIOM_WALLET_TAB_BTN,
                      active ? AXIOM_WALLET_TAB_ACTIVE : AXIOM_WALLET_TAB_IDLE,
                      disabled && 'cursor-not-allowed opacity-35',
                    )}
                  >
                    <img
                      src={tab.icon}
                      alt=""
                      className="h-3.5 w-3.5 shrink-0 rounded-full object-contain"
                      draggable={false}
                      aria-hidden
                    />
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <Link
              href="/wallets"
              title="Manage wallets"
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-[#2e2e32] text-[#888892] transition-colors hover:bg-[#252528] hover:text-white"
            >
              <Settings className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </Link>
          </div>
        ) : null}

        <div className="flex flex-col gap-2.5 px-3 pb-3">
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
              className="text-[14px] font-medium tabular-nums text-white"
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
              <span className="text-[14px] font-medium tabular-nums text-white">
                {formatUsdcAmount(usdcAmount)}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 px-3 pb-3">
          <button type="button" onClick={handleDeposit} className={AXIOM_DEPOSIT_BTN}>
            <ArrowDownToLine className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
            Deposit
          </button>
          <button type="button" onClick={handleWithdraw} className={AXIOM_WITHDRAW_BTN}>
            <ArrowUpToLine className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
            Withdraw
          </button>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
