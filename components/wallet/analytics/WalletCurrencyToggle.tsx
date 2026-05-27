'use client';

import { ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function WalletCurrencyToggle({
  usdMode,
  nativeSym,
  onToggle,
  className,
}: {
  usdMode: boolean;
  nativeSym: string;
  onToggle: () => void;
  className?: string;
}) {
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
