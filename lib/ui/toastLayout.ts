'use client';

import { useUIStore } from '@/store/ui';

/** When the co-pilot answer / briefing strip is open, anchor toasts top-right. */
export function selectToastAnchorRight(s: {
  copilotTopStripActive: boolean;
  copilotDisplayMode: string;
  copilotPillExpanded: boolean;
}): boolean {
  return (
    s.copilotTopStripActive ||
    (s.copilotDisplayMode === 'pill' && s.copilotPillExpanded)
  );
}

export function readToastAnchorRight(): boolean {
  return selectToastAnchorRight(useUIStore.getState());
}

export type ToastPlacement = 'top-center' | 'top-right' | 'bottom-right';

export function toastPlacement(kind: 'copy' | 'app' = 'app'): ToastPlacement {
  if (readToastAnchorRight()) return 'top-right';
  return kind === 'copy' ? 'top-center' : 'bottom-right';
}

export function toastOffset(placement: ToastPlacement) {
  if (placement === 'top-right') {
    return { top: 'calc(var(--app-topbar-h) + 12px)', right: '14px' };
  }
  if (placement === 'top-center') {
    return { top: 'calc(var(--app-topbar-h) + 12px)' };
  }
  return undefined;
}

export function useToastAnchorRight(): boolean {
  return useUIStore(selectToastAnchorRight);
}
