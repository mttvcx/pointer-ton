'use client';

import type { PulseAssetMode } from '@/store/pulseAssetMode';
import { cn } from '@/lib/utils/cn';

const MODES: { id: PulseAssetMode; label: string }[] = [
  { id: 'memes', label: 'Pulse' },
  { id: 'stocks', label: 'Stocks' },
];

interface PulseModeSelectorProps {
  mode: PulseAssetMode;
  onChange: (mode: PulseAssetMode) => void;
  variant?: 'default' | 'workspace' | 'hero' | 'chain' | 'label';
  className?: string;
}

/** Nav-style tabs, hero tabs, or plain text labels (Pulse workspace left rail). */
export function PulseModeSelector({
  mode,
  onChange,
  variant = 'default',
  className,
}: PulseModeSelectorProps) {
  const hero = variant === 'hero';
  const label = variant === 'label';
  const chain = variant === 'chain';
  const workspace = variant === 'workspace' || hero;
  return (
    <nav
      role="tablist"
      aria-label="Pulse asset mode"
      className={cn(
        'flex shrink-0 flex-nowrap items-center',
        label && 'gap-1 sm:gap-1.5',
        chain && 'gap-0.5 rounded-md bg-white/[0.04] p-0.5 ring-1 ring-white/[0.08]',
        hero ? 'gap-1 sm:gap-2' : chain || label ? '' : 'gap-0.5',
        className,
      )}
    >
      {MODES.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m.id)}
            className={cn(
              'relative shrink-0 cursor-pointer whitespace-nowrap font-medium transition-colors duration-150',
              label
                ? 'rounded-md px-2.5 py-1.5 text-[16px] font-medium leading-none tracking-tight transition-all duration-150 sm:px-3 sm:py-2 sm:text-[17px]'
                : cn(
                    chain
                      ? 'rounded-[5px] px-2.5 py-1 text-[11px] font-semibold tracking-tight'
                      : cn(
                          'rounded-md',
                          hero
                            ? 'px-4 py-2 text-[1.25rem] font-semibold tracking-tight sm:px-5 sm:py-2.5 sm:text-[1.5rem]'
                            : workspace
                              ? 'px-3 py-2 text-[14px] sm:text-[15px]'
                              : 'px-2.5 py-1.5 text-[12px] sm:text-[13px]',
                        ),
                  ),
              label
                ? active
                  ? 'bg-white/[0.08] text-fg-primary'
                  : 'text-fg-secondary hover:bg-white/[0.06] hover:text-fg-primary'
                : chain
                  ? active
                    ? 'bg-white/[0.1] text-fg-primary shadow-[0_0_0_1px_rgba(255,255,255,0.14)]'
                    : 'text-fg-muted hover:bg-white/[0.06] hover:text-fg-secondary'
                  : active
                    ? 'text-fg-primary after:absolute after:bottom-0 after:left-2 after:right-2 after:h-[2px] after:rounded-full after:bg-fg-primary/90'
                    : 'text-fg-secondary hover:bg-white/[0.06] hover:text-fg-primary',
            )}
          >
            {m.label}
          </button>
        );
      })}
    </nav>
  );
}
