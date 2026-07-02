'use client';

import { Zap } from 'lucide-react';
import { CloseButton } from '@/components/ui/CloseButton';
import { cn } from '@/lib/utils/cn';
import {
  useSearchModalPrefsStore,
  type SearchQuickBuyChrome,
  type SearchQuickBuySize,
} from '@/store/searchModalPrefs';

const SIZES: { id: SearchQuickBuySize; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'large', label: 'Large' },
  { id: 'mega', label: 'Mega' },
  { id: 'ultra', label: 'Ultra' },
];

const CHROME: { id: SearchQuickBuyChrome; label: string }[] = [
  { id: 'outline', label: 'Border Ultra' },
  { id: 'filled', label: 'Regular Ultra' },
  { id: 'accent', label: 'No Border' },
];

function previewBuyClass(size: SearchQuickBuySize, chrome: SearchQuickBuyChrome, selected: boolean) {
  // Wider spread so the four options read as a clear small→ultra size ramp
  // instead of four near-identical boxes.
  const h =
    size === 'small' ? 'h-6' : size === 'large' ? 'h-8' : size === 'mega' ? 'h-10' : 'h-12';
  const base = cn('inline-flex items-center justify-center gap-0.5 rounded px-1.5 font-semibold tabular-nums', h);
  if (chrome === 'filled') {
    return cn(base, 'border-0 bg-emerald-400 text-[#030806] text-[9px]');
  }
  if (chrome === 'accent') {
    return cn(base, 'border-0 bg-white/[0.12] text-fg-primary text-[9px]');
  }
  return cn(
    base,
    'border border-emerald-400/80 bg-transparent text-emerald-400 text-[9px]',
    selected && 'shadow-[0_0_12px_-4px_rgba(52,211,153,0.45)]',
  );
}

export function SearchQuickBuySettingsPanel({ onClose }: { onClose: () => void }) {
  const size = useSearchModalPrefsStore((s) => s.quickBuySize);
  const chrome = useSearchModalPrefsStore((s) => s.quickBuyChrome);
  const amount = useSearchModalPrefsStore((s) => s.quickBuyAmountSol);
  const setSize = useSearchModalPrefsStore((s) => s.setQuickBuySize);
  const setChrome = useSearchModalPrefsStore((s) => s.setQuickBuyChrome);
  const setAmount = useSearchModalPrefsStore((s) => s.setQuickBuyAmountSol);

  return (
    <div
      className="absolute inset-0 z-20 flex items-start justify-center bg-black/35 p-4 pt-8 backdrop-blur-md"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-[360px] overflow-hidden rounded-xl border border-white/[0.08] bg-bg-raised/95 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.75)] backdrop-blur-xl"
        role="dialog"
        aria-labelledby="search-qb-settings-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3.5 py-2.5">
          <h3 id="search-qb-settings-title" className="text-[13px] font-semibold text-fg-primary">
            Settings
          </h3>
          <CloseButton label="Close settings" onClick={onClose} />
        </div>

        <div className="space-y-4 p-3.5">
          <div>
            <p className="mb-2 text-[11px] font-medium text-fg-muted">Button size</p>
            <div className="grid grid-cols-4 gap-1.5">
              {SIZES.map(({ id, label }) => {
                const selected = size === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSize(id)}
                    className={cn(
                      'flex min-h-[76px] flex-col items-center justify-end gap-1.5 rounded-lg border-0 py-2 text-[10px] font-semibold transition',
                      selected
                        ? 'bg-white/[0.12] text-fg-primary backdrop-blur-sm'
                        : 'bg-transparent text-fg-muted hover:bg-white/[0.07] hover:text-fg-secondary hover:backdrop-blur-sm',
                    )}
                  >
                    <span className={previewBuyClass(id, chrome, selected)}>
                      <Zap className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
                      {amount}
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            {CHROME.map(({ id, label }) => {
              const selected = chrome === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setChrome(id)}
                  className={cn(
                    'flex w-full items-center justify-center gap-1.5 rounded-lg border-0 py-2.5 text-[12px] font-semibold transition',
                    selected
                      ? 'bg-white/[0.1] text-fg-primary backdrop-blur-sm'
                      : 'bg-white/[0.03] text-fg-secondary hover:bg-white/[0.08] hover:backdrop-blur-sm',
                  )}
                >
                  <Zap
                    className={cn(
                      'h-3.5 w-3.5',
                      id === 'filled' ? 'fill-emerald-400 text-emerald-400' : 'text-fg-primary',
                    )}
                    strokeWidth={2.5}
                    aria-hidden
                  />
                  {label}
                </button>
              );
            })}
          </div>

          <label className="flex items-center justify-between gap-3 text-[11px] text-fg-secondary">
            <span>Search buy amount</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={amount}
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  if (Number.isFinite(n) && n > 0) setAmount(n);
                }}
                className="w-16 rounded-md border-0 bg-white/[0.06] px-2 py-1 font-mono text-xs text-fg-primary outline-none focus:bg-white/[0.09] focus:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
              />
              <span className="text-fg-muted">SOL</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
