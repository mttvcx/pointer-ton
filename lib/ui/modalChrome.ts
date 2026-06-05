import { cn } from '@/lib/utils/cn';

/** Backdrop scrim — pair with `overlayBackdropClasses(visible)`. */
export const modalBackdropClass =
  'absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm';

/** Primary dialog panel — pair with `overlayPanelClasses(visible)`. */
export const modalPanelClass =
  'relative z-10 flex w-full flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-raised shadow-2xl';

export const modalCloseBtnClass =
  'focus-ring shrink-0 rounded-sm p-1.5 text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary';

export const modalBtnSecondaryClass =
  'btn-press focus-ring rounded-sm border border-border-subtle bg-bg-sunken px-4 py-2 text-[13px] font-semibold text-fg-secondary transition hover:border-border-default hover:bg-bg-hover hover:text-fg-primary disabled:opacity-50';

/** Axiom-style primary action — emerald outline, not solid fill. */
export const modalBtnPrimaryClass =
  'btn-press focus-ring rounded-sm border border-emerald-400/90 bg-transparent px-4 py-2 text-[13px] font-semibold text-emerald-400 transition hover:border-emerald-300/95 hover:bg-emerald-400/[0.08] disabled:opacity-50';

export const modalBtnDestructiveClass =
  'btn-press focus-ring rounded-sm border border-signal-bear/50 bg-signal-bear/10 px-4 py-2 text-[13px] font-semibold text-signal-bear transition hover:border-signal-bear/65 hover:bg-signal-bear/15 disabled:opacity-50';

export const modalTabActiveClass =
  'border-b-2 border-accent-primary pb-2 text-[12px] font-medium text-fg-primary';

export const modalTabIdleClass =
  'border-b-2 border-transparent pb-2 text-[12px] font-medium text-fg-muted transition hover:text-fg-secondary';

export const modalSectionLabelClass =
  'text-[10px] font-semibold uppercase tracking-wide text-fg-muted';

export const modalInputClass =
  'rounded-md border border-border-subtle bg-bg-sunken px-3 py-2 text-[12px] text-fg-primary outline-none transition placeholder:text-fg-muted/60 focus:border-border-default focus:ring-1 focus:ring-accent-primary/25';

export const modalPreviewPanelClass =
  'overflow-hidden rounded-md border border-border-subtle bg-bg-sunken p-3';

export function modalScopeTabClass(active: boolean) {
  return cn(
    'flex items-center gap-1.5 border-b-2 pb-2 text-[12px] font-medium transition-colors',
    active ? 'border-accent-primary text-fg-primary' : 'border-transparent text-fg-muted hover:text-fg-secondary',
  );
}
