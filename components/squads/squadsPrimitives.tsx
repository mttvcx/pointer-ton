'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** Shared elevated surface — restrained gradient + edge light (Squads flagship polish). */
export const squadElevatedClass =
  'border-[#283440] bg-gradient-to-b from-[#151c28]/98 via-[#0d1219] to-[#080b10] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_8px_32px_-28px_rgba(0,0,0,0.9)]';

export const squadCardHoverInteractiveClass =
  'transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-px hover:border-[#3f6078]/55 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_0_1px_rgba(46,132,188,0.11),0_12px_40px_-18px_rgba(0,0,0,0.7)] active:translate-y-0';

type PanelTone = 'default' | 'premium' | 'inset';

/** Restrained panel: dark navy, crisp border, minimal sheen (Squads ≠ Points candy). */
export function SquadPanel({
  children,
  className,
  padding = 'p-4',
  tone = 'default',
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
  tone?: PanelTone;
}) {
  const toneCls =
    tone === 'premium'
      ? squadElevatedClass
      : tone === 'inset'
        ? 'border-[#202833] bg-[#070a10] shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)]'
        : 'border-[#1b2129] bg-[#0d1117]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

  return (
    <div className={cn('rounded-lg border', toneCls, padding, className)}>{children}</div>
  );
}

/** Monogram tile with restrained ring + optional live dot. */
export function SquadMonogram({
  children,
  className,
  size = 'md',
  live,
}: {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  live?: boolean;
}) {
  const sz =
    size === 'lg'
      ? 'h-14 w-14 text-[15px]'
      : size === 'sm'
        ? 'h-9 w-9 text-[11px]'
        : 'h-12 w-12 text-[13px]';
  return (
    <div className={cn('relative shrink-0', sz)}>
      <div
        className={cn(
          'relative flex h-full w-full items-center justify-center rounded-md font-bold tracking-tight text-fg-primary ring-2 ring-black/55',
          className,
        )}
      >
        {children}
      </div>
      {live ? (
        <span className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border border-[#0d1117] bg-[#4ade80]" />
      ) : null}
    </div>
  );
}

export function SquadChip({
  children,
  selected,
  onClick,
  icon,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  icon?: ReactNode;
}) {
  const C = onClick ? 'button' : 'span';
  return (
    <C
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10.5px] font-semibold tracking-tight transition',
        selected
          ? 'border-[#2a9bc8]/55 bg-[#1d2c3d] text-fg-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
          : 'border-[#252b36] bg-[#0a0e14] text-fg-muted hover:border-[#38475a] hover:bg-[#10161f] hover:text-fg-secondary',
      )}
    >
      {icon}
      {children}
    </C>
  );
}

export function SquadSortShell({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-2 text-[11px] text-fg-muted">
      <span className="shrink-0 font-medium text-fg-secondary">Sort</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer rounded-md border border-[#283240] bg-[#090d14] px-2 py-1.5 text-[11px] font-semibold text-fg-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none focus:border-[#2a9bc8]/55"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function OperatorSignalTone({ level }: { level: 'high' | 'medium' | 'low' }) {
  const cls =
    level === 'high'
      ? 'text-[#6ee7b7] bg-[#6ee7b7]/12 border-[#4ade8066]'
      : level === 'medium'
        ? 'text-[#fbbf24] bg-[#fbbf24]/09 border-[#fcd34d55]'
        : 'text-fg-muted bg-white/[0.04] border-white/[0.12]';
  const label =
    level === 'high' ? 'High signal' : level === 'medium' ? 'Medium signal' : 'Low signal';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-tight',
        cls,
      )}
    >
      <span className="flex gap-px">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-2.5 w-0.5 rounded-full',
              level === 'high' || (level === 'medium' && i < 3) || (level === 'low' && i < 2)
                ? 'bg-current opacity-95'
                : 'bg-current opacity-20',
            )}
          />
        ))}
      </span>
      {label}
    </span>
  );
}
