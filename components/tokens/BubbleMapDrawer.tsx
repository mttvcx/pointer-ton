'use client';

import { useEffect, useRef } from 'react';
import { Workflow, X } from 'lucide-react';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses } from '@/lib/ui/overlayMotion';
import { PortalToBody } from '@/lib/ui/portalToBody';
import { BubbleMapPanel } from '@/components/tokens/BubbleMapPanel';
import { cn } from '@/lib/utils/cn';

/**
 * Axiom-style right-side pull-out for the holder bubble map. Slides in from the
 * right edge over a dimmed scrim and embeds the existing BubbleMapPanel unchanged.
 * Portaled to <body> so position:fixed escapes the token page's sticky/transformed
 * ancestors. Closes on Esc, backdrop click, and the header X.
 */
export function BubbleMapDrawer({
  mint,
  symbol,
  open,
  onClose,
}: {
  mint: string;
  symbol?: string;
  open: boolean;
  onClose: () => void;
}) {
  const { mounted, visible } = useOverlayPresence(open, 300);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Esc to close, lock body scroll (restore prior value), and manage focus:
  // pull focus into the drawer on open and return it to the opener on close.
  useEffect(() => {
    if (!open) return;
    const prevFocused = document.activeElement as HTMLElement | null;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => closeBtnRef.current?.focus(), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
      prevFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <PortalToBody>
      <div role="dialog" aria-modal="true" aria-labelledby="bubblemap-drawer-title" className="fixed inset-0 z-[530]">
        <button
          type="button"
          aria-label="Close bubble map"
          onClick={onClose}
          className={cn('absolute inset-0 bg-black/60 backdrop-blur-md', overlayBackdropClasses(visible))}
        />
        <div
          className={cn(
            'absolute inset-y-0 right-0 flex h-[100dvh] w-[min(720px,92vw)] max-[640px]:w-screen flex-col',
            'rounded-l-2xl border-l border-border-subtle bg-bg-raised shadow-[0_0_80px_-12px_rgba(0,0,0,0.85)]',
            'transition-transform duration-300 ease-[cubic-bezier(0.22,0.9,0.22,1)] motion-reduce:transition-none',
            visible ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          <div className="flex shrink-0 items-center gap-2.5 border-b border-border-subtle px-4 py-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-bg-sunken text-accent-primary">
              <Workflow className="h-4 w-4" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Holder bubble map</p>
              <p id="bubblemap-drawer-title" className="truncate text-[13px] font-semibold text-fg-primary">
                {symbol ? `$${symbol}` : 'Token'} clusters
              </p>
            </div>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-white/[0.06] hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50"
            >
              <X className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <BubbleMapPanel mint={mint} symbol={symbol} />
          </div>
        </div>
      </div>
    </PortalToBody>
  );
}
