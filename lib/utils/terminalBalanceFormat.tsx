'use client';

import { cn } from '@/lib/utils/cn';

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

function toSubscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUBSCRIPT_DIGITS[Number(d)] ?? d)
    .join('');
}

export type TerminalBalanceParts =
  | { kind: 'plain'; text: string }
  | { kind: 'subscript'; leading: string; zeroCount: number; tail: string };

/** Axiom / MEVX-style tiny native balances — e.g. 0.0₂8 for 0.008 SOL. */
export function parseTerminalNativeBalance(amount: number | null | undefined): TerminalBalanceParts {
  if (amount == null || !Number.isFinite(amount)) return { kind: 'plain', text: '0' };
  if (amount === 0) return { kind: 'plain', text: '0' };

  const abs = Math.abs(amount);
  if (abs >= 1) {
    const t = amount.toFixed(2).replace(/\.?0+$/, '');
    return { kind: 'plain', text: t };
  }
  if (abs >= 0.01) {
    const t = amount.toFixed(2).replace(/\.?0+$/, '');
    return { kind: 'plain', text: t };
  }

  const str = abs.toFixed(12);
  const match = str.match(/^0\.(0*)([1-9]\d*)/);
  if (!match) return { kind: 'plain', text: String(amount) };

  const zeroCount = match[1]?.length ?? 0;
  const tail = match[2]?.slice(0, 2) ?? '';
  if (zeroCount < 2) {
    return { kind: 'plain', text: parseFloat(amount.toPrecision(3)).toString() };
  }

  return { kind: 'subscript', leading: '0.0', zeroCount, tail };
}

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
      <sub className={cn('relative -bottom-px text-[0.72em] font-normal', subClassName)}>
        {toSubscript(parts.zeroCount)}
      </sub>
      {parts.tail}
    </span>
  );
}
