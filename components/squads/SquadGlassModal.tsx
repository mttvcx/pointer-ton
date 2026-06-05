'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { modalBackdropClass, modalCloseBtnClass, modalPanelClass } from '@/lib/ui/modalChrome';
import { cn } from '@/lib/utils/cn';

export function SquadGlassModal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const { mounted, visible } = useOverlayPresence(open);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[560] flex items-center justify-center p-4" role="dialog" aria-modal>
      <button
        type="button"
        className={cn(modalBackdropClass, overlayBackdropClasses(visible))}
        aria-label="Close"
        onClick={onClose}
      />
      <div className={cn(modalPanelClass, 'max-w-md p-0', overlayPanelClasses(visible))}>
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
          <h2 className="text-sm font-semibold text-fg-primary">{title}</h2>
          <button type="button" onClick={onClose} className={modalCloseBtnClass}>
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
      </div>
    </div>
  );
}
