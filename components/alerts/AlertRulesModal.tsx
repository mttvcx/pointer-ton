'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { AlertRulesSection, openAlertRulesPopoutDetached } from '@/components/alerts/AlertRulesSection';
import { useOverlayPresence, OVERLAY_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';

export function openAlertRulesModal() {
  useUIStore.getState().setAlertRulesModalOpen(true);
}

export function AlertRulesModal() {
  const open = useUIStore((s) => s.alertRulesModalOpen);
  const setOpen = useUIStore((s) => s.setAlertRulesModalOpen);
  const { mounted, visible } = useOverlayPresence(open, OVERLAY_ANIM_CLOSE_MS);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted) return null;

  const dockSidebar = () => {
    setOpen(false);
    useUIStore.getState().setAlertRulesDocked(true);
  };

  const detachFloating = () => {
    setOpen(false);
    queueMicrotask(() => openAlertRulesPopoutDetached());
  };

  return (
    <div className={cn('fixed inset-0 flex items-center justify-center', Z_APP_MODAL_OVERLAY)}>
      <button
        type="button"
        aria-label="Close"
        className={cn(
          'absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm',
          overlayBackdropClasses(visible),
        )}
        onClick={() => setOpen(false)}
      />

      <div
        data-modal-panel
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-rules-modal-title"
        className={cn(
          'relative z-10 mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-raised shadow-2xl',
          overlayPanelClasses(visible),
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-bg-raised px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="alert-rules-modal-title" className="text-sm font-semibold tracking-tight text-fg-primary">
              Pulse alerts
            </h2>
            <p className="text-xs text-fg-muted">Create and manage notification rules for new Pulse listings.</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <AlertRulesSection variant="modal" />
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border-subtle bg-bg-raised px-4 py-3">
          <button
            type="button"
            onClick={dockSidebar}
            className="rounded-md px-2.5 py-1.5 text-[11px] font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary"
          >
            Dock to sidebar
          </button>
          <button
            type="button"
            onClick={detachFloating}
            className="rounded-md px-2.5 py-1.5 text-[11px] font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary"
          >
            Floating window
          </button>
        </footer>
      </div>
    </div>
  );
}
