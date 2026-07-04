'use client';

import { CloseButton } from '@/components/ui/CloseButton';
import { cn } from '@/lib/utils/cn';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';

export type PrivateTransferProvider = 'splitnow' | 'husher_cex' | 'husher_xmr';

const PROVIDERS: {
  id: PrivateTransferProvider;
  label: string;
  sub: string;
  enabled: boolean;
  logo: string;
}[] = [
  {
    id: 'splitnow',
    label: 'SplitNOW CEX Funding',
    sub: 'Route via Binance, Bybit, Huobi & more',
    enabled: true,
    logo: '/logos/providers/splitnow.svg',
  },
  {
    id: 'husher_cex',
    label: 'Husher CEX Funding',
    sub: 'Coming soon',
    enabled: false,
    logo: '/logos/providers/husher.svg',
  },
  {
    id: 'husher_xmr',
    label: 'Husher Private (XMR)',
    sub: 'Coming soon',
    enabled: false,
    logo: '/logos/providers/husher-xmr.svg',
  },
];

export function PrivateTransferProviderModal({
  visible,
  sourceLabel,
  receiverLabel,
  onClose,
  onSelect,
}: {
  visible: boolean;
  sourceLabel: string;
  receiverLabel: string;
  onClose: () => void;
  onSelect: (provider: PrivateTransferProvider) => void;
}) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className={cn('absolute inset-0 bg-black/70', overlayBackdropClasses(true))}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full max-w-md overflow-hidden rounded-xl border border-border-subtle bg-bg-raised shadow-2xl',
          overlayPanelClasses(true),
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-fg-primary">
              Privately transfer {sourceLabel} to {receiverLabel}
            </h2>
            <p className="mt-1 text-[11px] text-fg-muted">
              Select a provider to privately transfer SOL between wallets.
            </p>
          </div>
          <CloseButton onClick={onClose} label="Close" />
        </div>

        <div className="space-y-2 p-4">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={!p.enabled}
              onClick={() => p.enabled && onSelect(p.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition',
                p.enabled
                  ? 'border-border-subtle bg-bg-sunken hover:border-accent-primary/35 hover:bg-accent-primary/8'
                  : 'cursor-not-allowed border-border-subtle/60 bg-bg-sunken/40 opacity-50',
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-bg-base text-[11px] font-bold text-accent-primary">
                {p.id === 'splitnow' ? 'SN' : p.id === 'husher_cex' ? 'H' : 'X'}
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold text-fg-primary">{p.label}</span>
                <span className="block text-[10px] text-fg-muted">{p.sub}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="flex justify-center gap-1.5 border-t border-border-subtle py-3">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn('h-1.5 w-1.5 rounded-full', i === 0 ? 'bg-accent-primary' : 'bg-white/15')}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
