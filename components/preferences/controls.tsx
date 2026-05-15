'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Shared preference primitives used by both `DisplayPopover` (top-bar tear-off)
 * and `DisplayPreferences` (settings modal section). Keeping them in one file
 * means the two surfaces stay visually consistent — same chrome, same hit
 * targets, same hover states.
 */

export function PrefField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
        {label}
      </div>
      {children}
    </div>
  );
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-md bg-bg-sunken p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            'rounded px-2 py-1 text-[11px] font-medium transition-colors',
            value === opt.value
              ? 'bg-bg-raised text-fg-primary'
              : 'text-fg-muted hover:text-fg-secondary',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function PrefToggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-start gap-3 text-left"
      role="switch"
      aria-checked={value}
    >
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-fg-primary">{label}</div>
        <div className="mt-0.5 text-[11px] leading-relaxed text-fg-muted">{description}</div>
      </div>
      <span
        className={cn(
          'mt-0.5 inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors',
          value ? 'bg-accent-primary' : 'bg-bg-sunken',
        )}
      >
        <span
          className={cn(
            'inline-block h-3 w-3 rounded-full bg-fg-primary transition-transform',
            value ? 'translate-x-3.5' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}
