'use client';

import { cn } from '@/lib/utils/cn';
import {
  parseTerminalNativeBalance,
  toSubscript,
  type TerminalBalanceParts,
} from '@/lib/utils/terminalNativeFormat';

export type { TerminalBalanceParts };
export { parseTerminalNativeBalance };

export function TerminalNativeBalance({
  amount,
  className,
  subClassName,
}: {
  amount: number | null | undefined;
  className?: string;
  subClassName?: string;
}) {
  const parts = parseTerminalNativeBalance(amount);
  if (parts.kind === 'plain') {
    return <span className={cn('tabular-nums', className)}>{parts.text}</span>;
  }
  return (
    <span className={cn('tabular-nums', className)}>
      {parts.leading}
      <sub className={cn('relative -bottom-[0.05em] text-[0.62em] font-normal leading-none', subClassName)}>
        {toSubscript(parts.zeroCount)}
      </sub>
      {parts.tail}
    </span>
  );
}

/** Axiom-style tiny USD prices — e.g. $0.0₃1 for sub-cent tokens. */
export function TerminalUsdPrice({
  price,
  className,
  subClassName,
}: {
  price: number | null | undefined;
  className?: string;
  subClassName?: string;
}) {
  const parts = parseTerminalNativeBalance(price);
  if (parts.kind === 'plain') {
    return <span className={cn('tabular-nums', className)}>${parts.text}</span>;
  }
  return (
    <span className={cn('tabular-nums', className)}>
      ${parts.leading}
      <sub className={cn('relative -bottom-[0.05em] text-[0.62em] font-normal leading-none', subClassName)}>
        {toSubscript(parts.zeroCount)}
      </sub>
      {parts.tail}
    </span>
  );
}

/** Session PnL cell — subscript native amount + rounded percent (Axiom parity). */
export function TerminalNativeTradePnl({
  pnl,
  pct,
  className,
  subClassName,
  pctClassName,
}: {
  pnl: number;
  pct: number | null;
  className?: string;
  subClassName?: string;
  pctClassName?: string;
}) {
  const pctRounded =
    pct == null || !Number.isFinite(pct) ? 0 : Math.abs(pct) < 0.05 ? 0 : Math.round(pct);
  const pctSign = pctRounded >= 0 ? '+' : '';
  return (
    <span className={cn('inline-flex items-baseline whitespace-nowrap tabular-nums', className)}>
      {pnl >= 0 ? '+' : null}
      <TerminalNativeBalance amount={pnl} className="inline" subClassName={subClassName} />
      <span className={cn('shrink-0 self-baseline text-[10px] font-normal leading-none', pctClassName)}>
        ({pctSign}
        {pctRounded}%)
      </span>
    </span>
  );
}

/** USD PnL cell — subscript when tiny + percent (Axiom parity). */
export function TerminalUsdTradePnl({
  pnl,
  pct,
  className,
  subClassName,
  pctClassName,
}: {
  pnl: number;
  pct: number | null;
  className?: string;
  subClassName?: string;
  pctClassName?: string;
}) {
  const pctRounded =
    pct == null || !Number.isFinite(pct) ? 0 : Math.abs(pct) < 0.05 ? 0 : Math.round(pct);
  const pctSign = pctRounded >= 0 ? '+' : '';
  return (
    <span className={cn('inline-flex items-baseline whitespace-nowrap tabular-nums', className)}>
      {pnl >= 0 ? '+' : '-'}
      <TerminalUsdPrice price={Math.abs(pnl)} subClassName={subClassName} />
      <span className={cn('shrink-0 self-baseline text-[10px] font-normal leading-none', pctClassName)}>
        ({pctSign}
        {pctRounded}%)
      </span>
    </span>
  );
}
