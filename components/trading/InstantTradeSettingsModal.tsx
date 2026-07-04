'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { CloseButton } from '@/components/ui/CloseButton';
import {
  readInstantTradeUiSettings,
  persistInstantTradeUiSettings,
  type InstantTradeUiSettings,
  defaultInstantTradeUiSettings,
} from '@/lib/trading/instantTradeUiSettings';

type Props = {
  open: boolean;
  onClose: () => void;
  onOpenFullTradeColumn?: () => void;
};

export function InstantTradeSettingsModal({ open, onClose, onOpenFullTradeColumn }: Props) {
  const [s, setS] = useState<InstantTradeUiSettings>(defaultInstantTradeUiSettings);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setS(readInstantTradeUiSettings()));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  function patch<K extends keyof InstantTradeUiSettings>(key: K, v: InstantTradeUiSettings[K]) {
    setS((prev) => {
      const next = { ...prev, [key]: v };
      persistInstantTradeUiSettings(next);
      return next;
    });
  }

  const row = (opts: {
    id: keyof InstantTradeUiSettings;
    title: string;
    description: string;
  }) => (
    <div className="flex items-start justify-between gap-3 border-b border-border-subtle py-3 last:border-b-0">
      <div>
        <div className="text-[12px] font-semibold text-fg-primary">{opts.title}</div>
        <p className="mt-1 text-[10px] leading-snug text-fg-muted">{opts.description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={s[opts.id]}
        onClick={() => patch(opts.id, !s[opts.id])}
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full transition-colors',
          s[opts.id] ? 'bg-accent-primary' : 'bg-fg-muted/25',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 block h-5 w-5 rounded-full bg-fg-inverse shadow transition-all',
            s[opts.id] ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[530] flex animate-in fade-in items-center justify-center p-4 duration-200">
      <button
        type="button"
        className="absolute inset-0 bg-black/65"
        aria-label="Close instant trade settings"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[90vh] w-full max-w-md animate-in zoom-in-95 fade-in flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-base shadow-2xl duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="instant-settings-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 id="instant-settings-title" className="text-sm font-semibold text-fg-primary">
            Instant trade settings
          </h2>
          <CloseButton onClick={onClose} label="Close" size="sm" />
        </div>

        <div className="border-b border-border-subtle bg-accent-primary/10 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-accent-primary">
            Preview
          </p>
          <div className="mt-2 flex gap-1">
            {['25%', '50%', '75%', '100%'].map((t) => (
              <span
                key={t}
                className="rounded-full border border-rose-400/60 px-2 py-0.5 tabular-nums text-[9px] text-rose-200"
              >
                {t}
              </span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 tabular-nums text-[10px]">
            <span className="text-signal-bull">$1.2</span>
            <span className="text-signal-bear">$0.5</span>
            <span className="text-fg-secondary">$0.7</span>
            <span className="text-signal-bull">+$0.2 (+16%)</span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {row({
            id: 'showPnlRow',
            title: 'PNL row',
            description: 'Show PnL summary row under buy/sell chips.',
          })}
          {row({
            id: 'changeOnHover',
            title: 'Change on hover',
            description: 'Instant trade shows reflected amount when hovering presets (coming soon).',
          })}
          {row({
            id: 'resetPnlOnClose',
            title: 'Reset PNL',
            description: 'Reset PnL when position is fully closed (coming soon).',
          })}
          {row({
            id: 'walletOpensSidebar',
            title: 'Wallet button opens sidebar',
            description: 'Use wide multi-wallet layout instead of compact menu (coming soon).',
          })}
          {row({
            id: 'walletGroupGrid',
            title: 'Wallet group grid',
            description: 'Show wallet groups in a grid (coming soon).',
          })}
          {row({
            id: 'hotkeysEnabled',
            title: 'Hotkeys',
            description: 'Hold spacebar for quick keys (coming soon).',
          })}
        </div>

        <div className="border-t border-border-subtle p-3">
          {onOpenFullTradeColumn ? (
            <button
              type="button"
              onClick={() => {
                onOpenFullTradeColumn();
                onClose();
              }}
              className="btn-press mb-2 w-full rounded-lg border border-border-subtle py-2 text-[11px] font-medium text-fg-secondary hover:bg-bg-hover"
            >
              Open full trade column (presets & fees)
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="btn-press w-full rounded-lg bg-accent-primary py-2.5 text-sm font-semibold text-fg-inverse hover:brightness-110"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
