'use client';

import type { ReactNode } from 'react';
import { squadsAvatarTint } from '@/lib/squads/avatarTint';
import { cn } from '@/lib/utils/cn';

/** Shared elevated surface — theme grey, not nested black. */
export const squadElevatedClass =
  'border-border-subtle bg-bg-hover shadow-[inset_0_1px_0_rgb(var(--fg-primary-rgb)/0.04)]';

export const squadCardHoverInteractiveClass =
  'transition-colors duration-150 hover:border-border';

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
          'relative flex h-full w-full items-center justify-center rounded-md font-bold tracking-tight text-fg-primary ring-1 ring-border-subtle',
          className,
        )}
      >
        {children}
      </div>
      {live ? (
        <span className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border border-bg-raised bg-signal-bull" />
      ) : null}
    </div>
  );
}

/** Circular profile tile — initials + deterministic tint. */
export function SquadAvatar({
  seed,
  initials,
  size = 'md',
  className,
}: {
  seed: string;
  initials: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sz =
    size === 'lg'
      ? 'h-12 w-12 text-[13px]'
      : size === 'sm'
        ? 'h-7 w-7 text-[9px]'
        : 'h-9 w-9 text-[10px]';
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold text-fg-primary',
        squadsAvatarTint(seed),
        sz,
        className,
      )}
    >
      {initials}
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
        'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium tracking-tight transition-colors',
        selected
          ? 'bg-accent-ethos/10 text-accent-ethos ring-1 ring-inset ring-accent-ethos/25'
          : 'bg-bg-sunken text-fg-secondary hover:bg-bg-hover hover:text-fg-primary',
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
        className="cursor-pointer rounded-md border border-border-subtle bg-bg-sunken px-2 py-1.5 text-[11px] font-semibold text-fg-primary outline-none focus:border-accent-primary/50"
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
