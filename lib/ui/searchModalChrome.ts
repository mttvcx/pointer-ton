import { cn } from '@/lib/utils/cn';

/** Token-page grey shell — seamless, minimal chrome. */
export const searchModalPanelClass =
  'rounded-xl border border-white/[0.06] bg-bg-raised shadow-[0_28px_80px_-36px_rgba(0,0,0,0.82)]';

export const searchModalIconBtnClass =
  'focus-ring rounded-md border-0 bg-transparent p-1.5 text-fg-muted transition-colors hover:bg-white/[0.08] hover:text-fg-primary hover:backdrop-blur-sm';

export const searchModalChipIdleClass =
  'border-0 bg-transparent text-fg-muted hover:bg-white/[0.07] hover:text-fg-secondary hover:backdrop-blur-sm';

export const searchModalInputShellClass =
  'flex h-10 items-center rounded-lg border-0 bg-white/[0.04] px-2.5 transition-[background-color,box-shadow] duration-150 focus-within:bg-white/[0.06] focus-within:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]';

export const searchModalRowHoverClass = cn(
  'group relative transition-colors hover:bg-white/[0.04]',
  'after:pointer-events-none after:absolute after:right-0 after:top-2 after:bottom-2 after:w-[2px]',
  'after:rounded-full after:bg-accent-primary after:opacity-0 after:transition-opacity',
  'hover:after:opacity-90',
);

export function searchModalChipActiveClass(tint: string) {
  return cn('border-0', tint);
}
