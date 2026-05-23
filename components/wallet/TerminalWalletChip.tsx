'use client';

import { ChevronDown, Wallet } from 'lucide-react';
import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';
import { TerminalNativeBalance } from '@/lib/utils/terminalBalanceFormat';
import { cn } from '@/lib/utils/cn';

const USDC_ICON = '/logos/protocols/usdc.png';

export type TerminalWalletChipProps = {
  walletCount?: number | null;
  nativeBalance: number | null;
  usdcBalance?: number | null;
  activeChain: AppChainId;
  variant?: 'header' | 'dock';
  showChevron?: boolean;
  className?: string;
};

function formatUsdcChip(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount) || amount === 0) return '0';
  if (amount >= 100) return amount.toFixed(1).replace(/\.0$/, '');
  if (amount >= 1) return amount.toFixed(2).replace(/\.?0+$/, '');
  return parseFloat(amount.toPrecision(3)).toString();
}

function AssetPair({
  iconSrc,
  amount,
  isNative,
  size,
}: {
  iconSrc: string;
  amount: number | null;
  isNative?: boolean;
  size: 'header' | 'dock';
}) {
  const iconCls = size === 'dock' ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5';
  const textCls = size === 'dock' ? 'text-[11px]' : 'text-[11px]';
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <img
        src={iconSrc}
        alt=""
        draggable={false}
        className={cn('shrink-0 rounded-full object-contain', iconCls)}
        aria-hidden
      />
      {isNative ? (
        <TerminalNativeBalance amount={amount} className={cn('font-medium text-white/90', textCls)} />
      ) : (
        <span className={cn('tabular-nums font-medium text-white/75', textCls)}>
          {formatUsdcChip(amount)}
        </span>
      )}
    </span>
  );
}

/**
 * Axiom / MEVX compact wallet strip — icon+balance pairs, fully rounded pill.
 */
export function TerminalWalletChip({
  walletCount,
  nativeBalance,
  usdcBalance,
  activeChain,
  variant = 'header',
  showChevron = true,
  className,
}: TerminalWalletChipProps) {
  const isDock = variant === 'dock';
  const showUsdc = activeChain === 'sol' && usdcBalance != null;
  const showCount = isDock && walletCount != null && walletCount > 0;

  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center',
        isDock ? 'gap-1.5' : 'gap-1.5',
        className,
      )}
    >
      <Wallet
        className={cn('shrink-0 text-white/55', isDock ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5')}
        strokeWidth={isDock ? 2 : 1.75}
        aria-hidden
      />

      {showCount ? (
        <>
          <span
            className={cn(
              'shrink-0 tabular-nums font-medium text-white/80',
              isDock ? 'text-[11px]' : 'text-[12px]',
            )}
          >
            {walletCount}
          </span>
          <span className="h-3 w-px shrink-0 bg-white/10" aria-hidden />
        </>
      ) : null}

      <AssetPair
        iconSrc={CHAIN_ICON_PNG[activeChain]}
        amount={nativeBalance}
        isNative
        size={isDock ? 'dock' : 'header'}
      />

      {showUsdc ? (
        <AssetPair iconSrc={USDC_ICON} amount={usdcBalance} size={isDock ? 'dock' : 'header'} />
      ) : null}

      {showChevron ? (
        <ChevronDown
          className={cn('shrink-0 text-white/40', isDock ? 'h-3 w-3' : 'h-3.5 w-3.5')}
          strokeWidth={2.25}
          aria-hidden
        />
      ) : null}
    </span>
  );
}
