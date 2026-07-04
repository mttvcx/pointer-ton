'use client';

import { useEffect } from 'react';
import { MousePointer2 } from 'lucide-react';
import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';
import { BlitzLandingPreview, BlitzPrioBribePreview } from '@/components/trading/blitzExplainUi';
import { BLITZ_NONCE_SETUP_SOL } from '@/lib/trading/blitz';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { useOverlayPresence, OVERLAY_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses } from '@/lib/ui/overlayMotion';
import { PortalToBody } from '@/lib/ui/portalToBody';
import { CloseButton } from '@/components/ui/CloseButton';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { cn } from '@/lib/utils/cn';

type Props = {
  open: boolean;
  onClose: () => void;
  onEnable: () => void;
  walletLabel?: string;
  activeChain: AppChainId;
  demoBuyAmount?: number;
};

export function EnableBlitzModal({
  open,
  onClose,
  onEnable,
  walletLabel,
  activeChain,
  demoBuyAmount = 0.5,
}: Props) {
  const { mounted, visible } = useOverlayPresence(open, OVERLAY_ANIM_CLOSE_MS);
  const nativeSym = nativeTicker(activeChain);

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
    <PortalToBody>
      <div className={cn(Z_APP_MODAL_OVERLAY, 'fixed inset-0 flex items-center justify-center p-3 sm:p-6')}>
        <button
          type="button"
          aria-label="Close"
          className={cn('absolute inset-0 bg-black/60 backdrop-blur-sm', overlayBackdropClasses(visible))}
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-labelledby="enable-blitz-title"
          aria-modal="true"
          className={cn(
            'relative z-10 box-border flex w-full max-w-[400px] flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-raised shadow-2xl',
            visible ? 'opacity-100' : 'opacity-0',
            'transition-opacity duration-100',
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border-subtle bg-bg-sunken/35 px-4 py-3">
            <h2 id="enable-blitz-title" className="text-[13px] font-semibold text-fg-primary">
              Enable Blitz Mode
            </h2>
            <CloseButton onClick={onClose} label="Close" size="sm" />
          </header>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-3">
            <div className="box-border w-full max-w-full space-y-5">
              {walletLabel ? (
                <p className="text-[12px] text-fg-muted">
                  For <span className="font-semibold text-fg-secondary">{walletLabel}</span>
                </p>
              ) : null}

              <section className="box-border w-full max-w-full space-y-2">
                <div className="inline-flex items-center gap-1.5 rounded-md border border-accent-primary/35 bg-accent-primary/10 px-2.5 py-1 text-[11px] font-semibold text-accent-primary">
                  <MousePointer2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                  <span className="tabular-nums">Buy {demoBuyAmount}</span>
                  <img
                    src={CHAIN_ICON_PNG[activeChain]}
                    alt=""
                    width={14}
                    height={14}
                    className="h-3.5 w-3.5 shrink-0 object-contain"
                    draggable={false}
                    aria-hidden
                  />
                </div>
                <BlitzLandingPreview />
                <p className="text-[11px] leading-relaxed text-fg-muted">
                  Blitz fires Helius Sender and Jito bundles in parallel. Whichever lands first wins.
                  Your best shot when pools are crowded.
                </p>
              </section>

              <section className="box-border w-full max-w-full space-y-2 border-t border-border-subtle pt-4">
                <BlitzPrioBribePreview />
                <p className="text-[11px] leading-relaxed text-fg-muted">
                  Blitz auto-tunes priority fee and Jito tip so you stay ahead of other txs. No
                  preset babysitting.
                </p>
              </section>

              <p className="text-[11px] leading-relaxed text-fg-muted">
                Built for traders who need the fastest fills. A one-time durable nonce costs about{' '}
                {BLITZ_NONCE_SETUP_SOL} {nativeSym} in network rent. None of that goes to Pointer.
              </p>
            </div>
          </div>

          <footer className="shrink-0 border-t border-border-subtle bg-bg-sunken/25 px-4 py-3">
            <button
              type="button"
              className="w-full rounded-lg bg-accent-primary py-2.5 text-[13px] font-semibold text-fg-inverse transition hover:brightness-110"
              onClick={() => {
                onEnable();
                onClose();
              }}
            >
              Enable Blitz
            </button>
          </footer>
        </div>
      </div>
    </PortalToBody>
  );
}
