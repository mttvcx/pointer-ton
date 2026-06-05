'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ThemePicker } from '@/components/theme/ThemePicker';
import { CustomThemeImport } from '@/components/theme/CustomThemeImport';
import { useOverlayPresence, OVERLAY_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { applyCustomFontUrl } from '@/lib/ui/customFont';
import { cn } from '@/lib/utils/cn';
import { useShellPrefsStore } from '@/store/shellPrefs';
import {
  NotificationToggleRow,
  ToastPositionPicker,
} from '@/components/layout/bottomBar/notificationSettingsUi';

function ShellModal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const { mounted, visible } = useOverlayPresence(open, OVERLAY_ANIM_CLOSE_MS);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div className={cn('fixed inset-0 z-[570] flex items-center justify-center p-3 sm:p-6')}>
      <button
        type="button"
        aria-label="Close"
        className={cn('absolute inset-0 bg-black/60 backdrop-blur-sm', overlayBackdropClasses(visible))}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 flex max-h-[min(88dvh,720px)] w-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-raised shadow-2xl',
          wide ? 'max-w-[520px]' : 'max-w-[400px]',
          overlayPanelClasses(visible),
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-bg-sunken/35 px-4 py-3">
          <h2 className="text-[13px] font-semibold text-fg-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">{children}</div>
        {footer ? (
          <footer className="shrink-0 border-t border-border-subtle bg-bg-sunken/25 px-4 py-3">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}

/** Axiom-style: theme presets + custom font + import in one modal. */
export function BottomBarThemeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const url = useShellPrefsStore((s) => s.customFontUrl);
  const setUrl = useShellPrefsStore((s) => s.setCustomFontUrl);
  const [draft, setDraft] = useState(url);

  useEffect(() => {
    if (open) setDraft(url);
  }, [open, url]);

  function handleDone() {
    const trimmed = draft.trim();
    setUrl(trimmed);
    applyCustomFontUrl(trimmed);
    onClose();
  }

  function handleResetFont() {
    setDraft('');
    setUrl('');
    applyCustomFontUrl('');
  }

  return (
    <ShellModal
      open={open}
      onClose={onClose}
      title="Customize Theme"
      wide
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleResetFont}
            className="rounded-md px-3 py-1.5 text-[11px] font-medium text-fg-muted transition hover:bg-white/[0.06] hover:text-fg-secondary"
          >
            Reset font
          </button>
          <button
            type="button"
            onClick={handleDone}
            className="rounded-lg bg-accent-primary px-5 py-2 text-[12px] font-semibold text-fg-inverse transition hover:brightness-110"
          >
            Done
          </button>
        </div>
      }
    >
      <ThemePicker />

      <div className="mt-5">
        <p className="mb-2 text-[12px] font-medium text-fg-primary">Custom Font</p>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Enter Google Fonts URL or custom font URL"
          className="w-full rounded-lg border-0 bg-white/[0.05] px-3 py-2.5 text-[12px] text-fg-primary outline-none placeholder:text-fg-muted/70 focus:bg-white/[0.08] focus:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
        />
        <p className="mt-2 text-[11px] text-fg-muted">
          Try Google Fonts:{' '}
          <a
            href="https://fonts.google.com"
            target="_blank"
            rel="noreferrer"
            className="text-accent-primary hover:underline"
          >
            fonts.google.com
          </a>
        </p>
      </div>

      <div className="mt-5 border-t border-white/[0.06] pt-4">
        <p className="mb-2 text-[12px] font-medium text-fg-primary">Import theme</p>
        <CustomThemeImport />
      </div>
    </ShellModal>
  );
}

export function BottomBarNotificationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const display = useShellPrefsStore((s) => s.displayNotifications);
  const setDisplay = useShellPrefsStore((s) => s.setDisplayNotifications);
  const sounds = useShellPrefsStore((s) => s.transactionSounds);
  const setSounds = useShellPrefsStore((s) => s.setTransactionSounds);
  const toastPos = useShellPrefsStore((s) => s.toastPosition);
  const setToastPos = useShellPrefsStore((s) => s.setToastPosition);

  return (
    <ShellModal
      open={open}
      onClose={onClose}
      title="Notification Settings"
      wide
      footer={
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg bg-accent-primary py-2.5 text-[13px] font-semibold text-fg-inverse transition hover:brightness-110"
        >
          Done
        </button>
      }
    >
      <div className="space-y-5 py-1">
        <NotificationToggleRow
          label="Display notifications"
          description="Display wallet tracker toasts, and notification cards"
          checked={display}
          onChange={setDisplay}
        />

        <ToastPositionPicker value={toastPos} onChange={setToastPos} />

        <div className="border-t border-white/[0.06] pt-4">
          <NotificationToggleRow
            label="Transaction sounds"
            checked={sounds}
            onChange={setSounds}
          />
        </div>
      </div>
    </ShellModal>
  );
}
