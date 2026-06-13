'use client';

import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function WalletCurrencyToggle({
  usdMode,
  nativeSym,
  onToggle,
  className,
  variant = 'default',
}: {
  usdMode: boolean;
  nativeSym: string;
  onToggle: () => void;
  className?: string;
  /** `pnl` — green circle beside PnL label (Axiom parity). */
  variant?: 'default' | 'icon' | 'pnl';
}) {
  if (variant === 'pnl' || variant === 'icon') {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'focus-ring inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full transition',
          variant === 'pnl'
            ? 'bg-signal-bull/15 text-signal-bull hover:bg-signal-bull/25'
            : 'border border-border-subtle bg-bg-sunken text-fg-muted hover:border-border-default hover:bg-bg-hover hover:text-fg-primary',
          className,
        )}
        title={`Switch to ${usdMode ? nativeSym : 'USD'}`}
        aria-label={`Currency: ${usdMode ? 'USD' : nativeSym}. Click to switch.`}
      >
        <ArrowUpDown className="h-2 w-2 shrink-0" strokeWidth={2.5} aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1 rounded border border-border-subtle px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary',
        className,
      )}
      title={`Switch to ${usdMode ? nativeSym : 'USD'}`}
      aria-label={`Currency: ${usdMode ? 'USD' : nativeSym}. Click to switch.`}
    >
      <ArrowUpDown className="h-2.5 w-2.5 shrink-0 opacity-70" strokeWidth={2.25} aria-hidden />
      {usdMode ? 'USD' : nativeSym}
    </button>
  );
}
