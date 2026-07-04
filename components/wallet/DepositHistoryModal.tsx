'use client';

import { History, ImageIcon } from 'lucide-react';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { cn } from '@/lib/utils/cn';
import { EX } from '@/components/wallet/exchangeModalUi';
import { CloseButton } from '@/components/ui/CloseButton';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DepositHistoryModal({ open, onOpenChange }: Props) {
  const { mounted, visible } = useOverlayPresence(open);

  if (!mounted) return null;

  return (
    <div className={cn('fixed inset-0 flex items-end justify-center sm:items-center sm:p-4', Z_APP_MODAL_OVERLAY)}>
      <button
        type="button"
        aria-label="Close"
        className={cn(
          'absolute inset-0 cursor-default bg-black/90 backdrop-blur-[2px]',
          overlayBackdropClasses(visible),
          'fill-mode-forwards',
        )}
        onClick={() => onOpenChange(false)}
      />
      <div
        data-modal-panel
        className={cn(EX.shell, 'fill-mode-forwards', overlayPanelClasses(visible))}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deposit-history-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={EX.header}>
          <h2 id="deposit-history-title" className={EX.title}>
            Deposit history
          </h2>
          <CloseButton onClick={() => onOpenChange(false)} label="Close" size="sm" />
        </div>
        <div className="px-4 py-3">
          <div className={cn('flex items-center gap-1.5', EX.muted)}>
            <History className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <span>Cross-chain deposits</span>
          </div>
          <div className={cn('mt-2 px-4 py-10 text-center', EX.inset)}>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-bg-hover text-fg-muted">
              <ImageIcon className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <p className="mt-3 text-[13px] font-medium text-fg-secondary">No deposits yet</p>
          </div>
        </div>
        <div className={EX.footer}>
          <button type="button" onClick={() => onOpenChange(false)} className={EX.cta}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
