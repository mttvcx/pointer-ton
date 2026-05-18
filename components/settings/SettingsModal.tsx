'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ThemePicker } from '@/components/theme/ThemePicker';
import { CustomThemeImport } from '@/components/theme/CustomThemeImport';
import { DisplayPreferences } from '@/components/preferences/DisplayPreferences';
import { useOverlayPresence, OVERLAY_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { cn } from '@/lib/utils/cn';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Centered settings overlay. Opens on top of the current page, URL does not
 * change, theme picker live-previews so the user sees swatches apply behind
 * the dialog.
 */
export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { mounted, visible } = useOverlayPresence(open, OVERLAY_ANIM_CLOSE_MS);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted) return null;

  return (
    <div className={cn('fixed inset-0 flex items-center justify-center', Z_APP_MODAL_OVERLAY)}>
      <button
        type="button"
        aria-label="Close"
        className={cn(
          'absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm',
          overlayBackdropClasses(visible),
        )}
        onClick={onClose}
      />

      <div
        data-modal-panel
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className={cn(
          'relative z-10 mx-4 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border-subtle bg-bg-raised shadow-2xl',
          overlayPanelClasses(visible),
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-[1] flex items-center justify-between border-b border-border-subtle bg-bg-raised px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <h2
              id="settings-modal-title"
              className="text-sm font-semibold tracking-tight text-fg-primary"
            >
              Settings
            </h2>
            <p className="text-xs text-fg-muted">Manage your Pointer preferences.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="space-y-6 px-4 py-4">
          <section>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
              Appearance
            </h3>
            <ThemePicker />
          </section>

          <section>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
              Display
            </h3>
            <DisplayPreferences />
          </section>

          <section>
            <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted">
              Custom theme
            </h3>
            <p className="mb-3 text-xs leading-relaxed text-fg-muted">
              Paste a JSON theme to apply your own palette. Use hex values
              (#0a0a0b) or RGB triplets ("10 10 11").
            </p>
            <CustomThemeImport />
          </section>
        </div>
      </div>
    </div>
  );
}
