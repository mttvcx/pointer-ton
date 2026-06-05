import { cn } from '@/lib/utils/cn';

const reduce = 'motion-reduce:animate-none';

/** Full-screen modal scrim / backdrop tap target (opacity only). */
export function overlayBackdropClasses(visible: boolean) {
  return visible
    ? cn('animate-in fade-in duration-100 ease-out', reduce, 'motion-reduce:opacity-100')
    : cn('animate-out fade-out duration-100 ease-out', reduce);
}

/** Centered dialog panel (fade + slight zoom). */
export function overlayPanelClasses(visible: boolean) {
  return visible
    ? cn(
        'animate-in fade-in zoom-in-95 duration-100 ease-out',
        reduce,
        'motion-reduce:opacity-100 motion-reduce:scale-100',
      )
    : cn(
        'animate-out fade-out zoom-out-95 duration-100 ease-out',
        reduce,
        'motion-reduce:opacity-0 motion-reduce:scale-100',
      );
}

/** Command-palette / top-anchored panel. */
export function overlayPanelFromTopClasses(visible: boolean) {
  return visible
    ? cn(
        'animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 ease-out',
        reduce,
        'motion-reduce:opacity-100 motion-reduce:scale-100 motion-reduce:translate-y-0',
      )
    : cn(
        'animate-out fade-out zoom-out-95 slide-out-to-top-2 duration-200 ease-out',
        reduce,
      );
}

/** anchored dropdowns — fade only avoids scale/slide-induced layout / subpixel wobble near fixed headers */
export function popoverPanelClasses(visible: boolean) {
  return visible
    ? cn(
        'animate-in fade-in duration-75 ease-out',
        reduce,
        'motion-reduce:opacity-100',
      )
    : cn(
        'animate-out fade-out duration-75 ease-out',
        reduce,
      );
}

/** Settings / Display popovers — dimmed scrim behind anchored panels (Axiom-style). */
export function settingsPopoverBackdropClasses(visible: boolean) {
  return visible
    ? cn('animate-in fade-in duration-150 ease-out', reduce, 'motion-reduce:opacity-100')
    : cn('animate-out fade-out duration-120 ease-out', reduce);
}

/** Subtle enter: fade + 4px slide + near-imperceptible scale (Axiom Display menu). */
export function settingsPopoverPanelClasses(visible: boolean) {
  return visible
    ? cn(
        'animate-in fade-in zoom-in-[0.985] slide-in-from-top-1 duration-150 ease-out',
        reduce,
        'motion-reduce:opacity-100 motion-reduce:scale-100 motion-reduce:translate-y-0',
      )
    : cn(
        'animate-out fade-out zoom-out-[0.985] slide-out-to-top-1 duration-120 ease-out',
        reduce,
      );
}

/** Wallet compact hover card — soft fade + 2px lift (Axiom trades desk parity). */
export function walletHoverPanelClasses(visible: boolean) {
  return visible
    ? cn(
        'animate-in fade-in zoom-in-[0.99] slide-in-from-top-0.5 duration-150 ease-out',
        reduce,
        'motion-reduce:opacity-100 motion-reduce:scale-100 motion-reduce:translate-y-0',
      )
    : cn(
        'animate-out fade-out zoom-out-[0.99] slide-out-to-top-0.5 duration-130 ease-out',
        reduce,
      );
}
