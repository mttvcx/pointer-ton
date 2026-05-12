'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
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
  /** Panel uses pointer shell tokens: frosted navy + thin highlight */
  className?: string;
};

/**
 * App-modal shell: blurred scrim + frosted panel (Azura / pro-terminal style, Pointer-themed).
 */
export function GlassModal({
  open,
  onClose,
  title,
  chainTicker,
  description,
  children,
  footer,
  zClass = 'z-[600]',
  maxWidthClass = 'max-w-md',
  className,
}: GlassModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const { mounted, visible } = useOverlayPresence(open);

  if (!mounted) return null;

  const hasHeader = Boolean(title || chainTicker || description);

  return (
    <div className={cn('fixed inset-0 flex items-center justify-center p-4', zClass)}>
      <button
        type="button"
        className={cn(
          'absolute inset-0 bg-[rgba(3,5,10,0.58)] backdrop-blur-md',
          overlayBackdropClasses(visible),
          'fill-mode-forwards',
        )}
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full overflow-hidden rounded-2xl border border-white/[0.09] fill-mode-forwards',
          'bg-[rgba(8,13,20,0.82)] shadow-[0_28px_72px_-28px_rgba(0,0,0,0.88)] backdrop-blur-xl backdrop-saturate-150',
          maxWidthClass,
          overlayPanelClasses(visible),
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.07] via-transparent to-transparent" />
        {hasHeader ? (
          <div className="relative flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 pb-3 pt-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {title ? (
                  <h2 className="text-[15px] font-semibold tracking-tight text-fg-primary">{title}</h2>
                ) : null}
                {chainTicker ? (
                  <span className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-secondary">
                    {chainTicker}
                  </span>
                ) : null}
              </div>
              {description ? (
                <div className="mt-1.5 text-[12px] leading-relaxed text-fg-secondary">{description}</div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring shrink-0 rounded-xl p-1.5 text-fg-muted transition hover:bg-white/[0.07] hover:text-fg-primary"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        ) : (
          <div className="absolute right-2 top-2 z-10">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-xl p-1.5 text-fg-muted transition hover:bg-white/[0.07] hover:text-fg-primary"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </div>
        )}

        {children ? <div className="relative px-4 py-3">{children}</div> : null}

        {footer ? (
          <div className="relative flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
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
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-fg-secondary transition hover:bg-white/[0.08] hover:text-fg-primary disabled:opacity-45"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void onConfirm()}
            className={cn(
              'rounded-xl px-4 py-2 text-[13px] font-semibold text-fg-inverse transition disabled:opacity-45',
              destructive
                ? 'bg-signal-bear hover:brightness-110'
                : 'bg-accent-primary hover:brightness-110',
            )}
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
