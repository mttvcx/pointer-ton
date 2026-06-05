'use client';

import { useUIStore } from '@/store/ui';
import { useShellPrefsStore, type ToastPosition } from '@/store/shellPrefs';

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

export type ToastPlacement = ToastPosition;

export function readToastPosition(): ToastPosition {
  return useShellPrefsStore.getState().toastPosition;
}

export function toastPlacement(_kind: 'copy' | 'app' = 'app'): ToastPlacement {
  if (readToastAnchorRight()) return 'top-right';
  return readToastPosition();
}

export function toastOffset(placement: ToastPlacement) {
  const top = 'calc(var(--app-topbar-h) + 12px)';
  const bottom = 'calc(var(--app-bottombar-h) + 12px)';
  const side = '14px';

  switch (placement) {
    case 'top-left':
      return { top, left: side };
    case 'top-center':
      return { top };
    case 'top-right':
      return { top, right: side };
    case 'bottom-left':
      return { bottom, left: side };
    case 'bottom-center':
      return { bottom };
    case 'bottom-right':
      return { bottom, right: side };
    default:
      return { bottom, right: side };
  }
}

export function useToastAnchorRight(): boolean {
  return useUIStore(selectToastAnchorRight);
}
