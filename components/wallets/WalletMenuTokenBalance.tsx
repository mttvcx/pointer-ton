'use client';

import { formatCompactNumber } from '@/lib/format';
import { formatNumber } from '@/lib/utils/formatters';
import { TerminalNativeBalance } from '@/lib/utils/terminalBalanceFormat';
import { cn } from '@/lib/utils/cn';

function tokenAmountUi(amount: number): { kind: 'compact'; text: string } | { kind: 'terminal'; amount: number } {
  if (!Number.isFinite(amount) || amount === 0) return { kind: 'compact', text: '0' };
  if (amount >= 1000) return { kind: 'compact', text: formatCompactNumber(amount) };
  if (amount >= 1) {
    const t = formatNumber(amount, { decimals: 2 }).replace(/\.?0+$/, '');
    return { kind: 'compact', text: t || '0' };
  }
  return { kind: 'terminal', amount };
}

/** Token balance pill for wallet picker rows (icon + compact / subscript amount). */
export function WalletMenuTokenBalance({
  amount,
  symbol,
  imageUrl,
  className,
  amountClassName,
  iconClassName = 'h-3.5 w-3.5',
}: {
  amount: number | null | undefined;
  symbol?: string | null;
  imageUrl?: string | null;
  className?: string;
  amountClassName?: string;
  iconClassName?: string;
}) {
  const ui = amount ?? 0;
  const parts = tokenAmountUi(ui);
  const sym = symbol?.trim() || 'TKN';
  const letter = sym.charAt(0).toUpperCase() || 'T';

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          width={14}
          height={14}
          className={cn('shrink-0 rounded-full object-cover', iconClassName)}
          draggable={false}
          aria-hidden
        />
      ) : (
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full bg-bg-hover text-[8px] font-bold uppercase text-fg-muted',
            iconClassName,
          )}
          aria-hidden
        >
          {letter}
        </span>
      )}
      {parts.kind === 'compact' ? (
        <span className={cn('text-xs font-semibold tabular-nums text-fg-secondary', amountClassName)}>
          {parts.text}
        </span>
      ) : (
        <TerminalNativeBalance
          amount={parts.amount}
          className={cn('text-xs font-semibold text-fg-secondary', amountClassName)}
        />
      )}
    </span>
  );
}
