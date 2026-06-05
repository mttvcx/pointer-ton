'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import {
  modalBackdropClass,
  modalBtnDestructiveClass,
  modalBtnPrimaryClass,
  modalBtnSecondaryClass,
  modalCloseBtnClass,
  modalPanelClass,
} from '@/lib/ui/modalChrome';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { cn } from '@/lib/utils/cn';

export type GlassModalProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** Network badge (e.g. SOL, TON) — keeps multi-chain flows scannable */
  chainTicker?: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  zClass?: string;
  maxWidthClass?: string;
  className?: string;
};

/**
 * App modal shell — matches SettingsModal / search overlays (raised panel, subtle border).
 */
export function GlassModal({
  open,
  onClose,
  title,
  chainTicker,
  description,
  children,
  footer,
  zClass = Z_APP_MODAL_OVERLAY,
  maxWidthClass = 'max-w-md',
  className,
}: GlassModalProps) {
  const [portalReady, setPortalReady] = useState(() => typeof document !== 'undefined');

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

  const { mounted, visible } = useOverlayPresence(open);

  if (!mounted || !portalReady) return null;

  const hasHeader = Boolean(title || chainTicker || description);

  return createPortal(
    <div className={cn('fixed inset-0 flex items-center justify-center p-4', zClass)}>
      <button
        type="button"
        className={cn(modalBackdropClass, overlayBackdropClasses(visible), 'fill-mode-forwards')}
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(modalPanelClass, maxWidthClass, overlayPanelClasses(visible), className)}
        onClick={(e) => e.stopPropagation()}
      >
        {hasHeader ? (
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {title ? (
                  <h2 className="text-sm font-semibold tracking-tight text-fg-primary">{title}</h2>
                ) : null}
                {chainTicker ? (
                  <span className="rounded-sm border border-border-subtle bg-bg-sunken px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-secondary">
                    {chainTicker}
                  </span>
                ) : null}
              </div>
              {description ? (
                <div className="mt-1 text-xs leading-relaxed text-fg-secondary">{description}</div>
              ) : null}
            </div>
            <button type="button" onClick={onClose} className={modalCloseBtnClass} aria-label="Close">
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        ) : (
          <div className="absolute right-2 top-2 z-10">
            <button type="button" onClick={onClose} className={modalCloseBtnClass} aria-label="Close">
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        )}

        {children ? (
          <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-3">
            {children}
          </div>
        ) : null}

        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border-subtle px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export type ConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: React.ReactNode;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  chainTicker?: string;
  zClass?: string;
};

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  pending,
  chainTicker,
  zClass,
}: ConfirmModalProps) {
  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title={title}
      chainTicker={chainTicker}
      zClass={zClass}
      maxWidthClass="max-w-[420px]"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={pending} className={modalBtnSecondaryClass}>
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void onConfirm()}
            className={destructive ? modalBtnDestructiveClass : modalBtnPrimaryClass}
          >
            {pending ? '…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-[13px] leading-relaxed text-fg-secondary">{body}</div>
    </GlassModal>
  );
}
