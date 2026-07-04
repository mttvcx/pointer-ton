'use client';

import type { CSSProperties, ReactNode, RefObject } from 'react';
import {
  settingsPopoverBackdropClasses,
  settingsPopoverPanelClasses,
} from '@/lib/ui/overlayMotion';
import { PortalToBody } from '@/lib/ui/portalToBody';
import { cn } from '@/lib/utils/cn';

type SettingsPopoverPortalProps = {
  mounted: boolean;
  visible: boolean;
  onClose: () => void;
  popoverRef: RefObject<HTMLDivElement | null>;
  panelClassName: string;
  style?: CSSProperties;
  children: ReactNode;
  role?: 'dialog' | 'menu';
  'aria-label'?: string;
  zIndexClass?: string;
};

/**
 * Anchored settings popover with full-viewport dim scrim (Axiom Display parity).
 * Pair with `useOverlayPresence` + `SETTINGS_POPOVER_ANIM_CLOSE_MS`.
 */
export function SettingsPopoverPortal({
  mounted,
  visible,
  onClose,
  popoverRef,
  panelClassName,
  style,
  children,
  role = 'dialog',
  'aria-label': ariaLabel,
  // Above the floating docks (wallet-tracker / X-Monitor are z-[221]) so the dim
  // backdrop covers them too — otherwise they stay bright over the settings fade.
  zIndexClass = 'z-[230]',
}: SettingsPopoverPortalProps) {
  if (!mounted) return null;

  return (
    <PortalToBody>
      <div className={cn('fixed inset-0', zIndexClass)}>
        <button
          type="button"
          aria-label="Close"
          className={cn(
            'absolute inset-0 cursor-default bg-black/55 backdrop-blur-[2px]',
            settingsPopoverBackdropClasses(visible),
          )}
          onClick={onClose}
        />
        <div
          ref={popoverRef}
          role={role}
          aria-label={ariaLabel}
          className={cn('fixed', panelClassName, settingsPopoverPanelClasses(visible))}
          style={style}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </PortalToBody>
  );
}
