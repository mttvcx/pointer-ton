'use client';

import { History, ImageIcon, X } from 'lucide-react';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { cn } from '@/lib/utils/cn';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Axiom-style empty deposit history sheet (cross-chain list not wired yet).
 */
export function DepositHistoryModal({ open, onOpenChange }: Props) {
  const { mounted, visible } = useOverlayPresence(open);

  if (!mounted) return null;

  return (
    <div
      className={cn('fixed inset-0 flex items-center justify-center p-4', Z_APP_MODAL_OVERLAY)}
      onMouseDown={(e) => {
        const t = e.target as HTMLElement | null;
        if (!t || t.closest('[data-modal-panel]')) return;
        onOpenChange(false);
      }}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 bg-black/70 backdrop-blur-[2px]',
          overlayBackdropClasses(visible),
          'fill-mode-forwards',
        )}
      />
      <div
        data-modal-panel
        className={cn(
          'relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-[#1b1f2a] bg-[#080d14] shadow-2xl',
          'fill-mode-forwards font-sans text-[12px]',
          overlayPanelClasses(visible),
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deposit-history-title"
      >
        <div className="flex items-center justify-between border-b border-[#1b1f2a] px-3 py-2.5">
          <h2 id="deposit-history-title" className="text-[14px] font-semibold text-white">
            Deposit History
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-1 text-[#9ca3af] transition hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <div className="px-3 py-2">
          <div className="flex items-center gap-1.5 text-[11px] text-[#6b7280]">
            <History className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span>Cross-chain Deposits</span>
          </div>
          <div className="mt-2 rounded-lg border border-[#1b1f2a] bg-[#12141b] px-4 py-10 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-[#1b1f2a] text-[#4b5563]">
              <ImageIcon className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <p className="mt-3 text-[13px] font-medium text-[#9ca3af]">No deposits yet</p>
          </div>
        </div>
        <div className="border-t border-[#1b1f2a] p-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="btn-press focus-ring w-full rounded-xl bg-accent-primary py-2.5 text-[13px] font-semibold text-fg-inverse transition hover:bg-accent-primary/95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
