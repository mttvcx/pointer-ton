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
