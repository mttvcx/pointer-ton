'use client';

import type { AppChainId } from '@/lib/chains/appChain';
import { nativeSpendIconSrc } from '@/lib/chains/chainAssets';
import { TerminalNativeBalance } from '@/lib/utils/terminalBalanceFormat';
import { cn } from '@/lib/utils/cn';

/** Native balance + chain icon for wallet picker rows (no ticker text). */
export function WalletMenuNativeBalance({
  amount,
  activeChain,
  className,
  amountClassName,
  iconClassName = 'h-3.5 w-3.5',
}: {
  amount: number | null | undefined;
  activeChain: AppChainId;
  className?: string;
  amountClassName?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <img
        src={nativeSpendIconSrc(activeChain)}
        alt=""
        width={14}
        height={14}
        className={cn('shrink-0 object-contain', iconClassName)}
        draggable={false}
        aria-hidden
      />
      <TerminalNativeBalance
        amount={amount}
        className={cn('text-xs font-semibold text-fg-secondary', amountClassName)}
      />
    </span>
  );
}
