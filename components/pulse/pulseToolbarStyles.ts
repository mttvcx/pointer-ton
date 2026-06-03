import { cn } from '@/lib/utils/cn';

/** Icon-only control (help, hidden, blacklist, autolaunch). */
export const pulseIconBtnCls = cn(
  'btn-press focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
  'border border-white/[0.08] text-fg-secondary transition-colors',
  'hover:border-white/[0.12] hover:bg-bg-hover/75 hover:text-fg-primary',
);

/** Pill control (Display). */
export const pulsePillBtnCls = cn(
  'btn-press focus-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md',
  'border border-white/[0.08] bg-bg-sunken/35 px-2.5 text-[13px] font-medium text-fg-secondary',
  'transition-colors hover:border-white/[0.12] hover:bg-bg-hover/75 hover:text-fg-primary',
);

/** Wallet multi-picker — Axiom / bottom-dock oval. */
export const pulseWalletBtnCls = cn(
  'btn-press focus-ring inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full',
  'border border-white/[0.08] bg-bg-sunken/35 px-2.5 transition-colors',
  'hover:border-white/[0.12] hover:bg-bg-hover/75 active:brightness-105',
);
