'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function TerminalCheckbox({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2', className)}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition',
          checked
            ? 'border-accent-primary/45 bg-accent-primary/15 text-accent-primary'
            : 'border-white/[0.12] bg-bg-sunken hover:border-white/20',
        )}
      >
        {checked ? <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden /> : null}
      </button>
      <span className="select-none">{label}</span>
    </label>
  );
}
