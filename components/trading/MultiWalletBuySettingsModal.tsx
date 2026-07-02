'use client';

import { useEffect, useState } from 'react';
import { PrefField, PrefToggle, SegmentedControl } from '@/components/preferences/controls';
import { CloseButton } from '@/components/ui/CloseButton';
import {
  defaultMultiWalletBuySettings,
  persistMultiWalletBuySettings,
  readMultiWalletBuySettings,
  type MultiWalletBuyDistribution,
  type MultiWalletBuySettings,
} from '@/lib/trading/multiWalletBuySettings';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { useUIStore } from '@/store/ui';
import { formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Selected wallet count — drives the live preview. */
  selectedWalletCount?: number;
};

const STAGGER_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 100, label: '100ms' },
  { value: 250, label: '250ms' },
  { value: 500, label: '500ms' },
] as const;

export function MultiWalletBuySettingsModal({
  open,
  onClose,
  selectedWalletCount = 3,
}: Props) {
  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);
  const [s, setS] = useState<MultiWalletBuySettings>(defaultMultiWalletBuySettings);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setS(readMultiWalletBuySettings()));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  function patch<K extends keyof MultiWalletBuySettings>(key: K, value: MultiWalletBuySettings[K]) {
    setS((prev) => {
      const next = { ...prev, [key]: value };
      persistMultiWalletBuySettings(next);
      return next;
    });
  }

  const previewChip = 0.1;
  const wallets = Math.max(1, selectedWalletCount);
  const perWallet =
    s.distribution === 'per_wallet' ? previewChip : previewChip / wallets;
  const totalOut =
    s.distribution === 'per_wallet' ? previewChip * wallets : previewChip;

  return (
    <div className="fixed inset-0 z-[530] flex animate-in fade-in items-center justify-center bg-black/65 p-4 duration-200">
      <div
        className="flex max-h-[90vh] w-full max-w-md animate-in zoom-in-95 fade-in flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-base shadow-2xl duration-200"
        role="dialog"
        aria-labelledby="multi-wallet-buy-settings-title"
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 id="multi-wallet-buy-settings-title" className="text-sm font-semibold text-fg-primary">
            Multi wallet buy settings
          </h2>
          <CloseButton onClick={onClose} label="Close" size="sm" />
        </div>

        <div className="border-b border-border-subtle bg-bg-sunken/50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Preview</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-fg-secondary">
            Chip{' '}
            <span className="font-semibold tabular-nums text-fg-primary">
              {formatNumber(previewChip, { decimals: 2 })} {nativeSym}
            </span>{' '}
            ·{' '}
            <span className="font-semibold tabular-nums text-fg-primary">{wallets}</span> wallet
            {wallets === 1 ? '' : 's'}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded-md border border-border-subtle bg-bg-raised px-2.5 py-2">
              <div className="text-fg-muted">Per wallet</div>
              <div className="mt-0.5 font-semibold tabular-nums text-accent-primary">
                {formatNumber(perWallet, { decimals: 4 })} {nativeSym}
              </div>
            </div>
            <div className="rounded-md border border-border-subtle bg-bg-raised px-2.5 py-2">
              <div className="text-fg-muted">Total routed</div>
              <div className="mt-0.5 font-semibold tabular-nums text-fg-primary">
                {formatNumber(totalOut, { decimals: 4 })} {nativeSym}
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
          <PrefField label="Buy amount">
            <SegmentedControl<MultiWalletBuyDistribution>
              value={s.distribution}
              onChange={(v) => patch('distribution', v)}
              options={[
                { value: 'per_wallet', label: 'Per wallet' },
                { value: 'split_total', label: 'Split total' },
              ]}
            />
            <p className="mt-1.5 text-[10px] leading-snug text-fg-muted">
              {s.distribution === 'per_wallet'
                ? 'Each selected wallet buys the full preset amount.'
                : 'The preset amount is divided evenly across selected wallets.'}
            </p>
          </PrefField>

          <PrefToggle
            label="Skip low balance wallets"
            description={`Do not route buys to wallets that cannot cover the amount plus ${formatNumber(s.minNativeReserve, { decimals: 3 })} ${nativeSym} reserve.`}
            value={s.skipInsufficientBalance}
            onChange={(v) => patch('skipInsufficientBalance', v)}
          />

          <PrefField label={`${nativeSym} reserve per wallet`}>
            <input
              type="number"
              min={0}
              step={0.001}
              value={s.minNativeReserve}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                patch('minNativeReserve', Math.max(0, n));
              }}
              className="w-full rounded-md border border-border-subtle bg-bg-sunken px-2.5 py-1.5 text-sm tabular-nums text-fg-primary outline-none focus:ring-1 focus:ring-accent-primary/35"
            />
            <p className="mt-1 text-[10px] text-fg-muted">
              Minimum native balance left in each wallet after a buy (rent + fees buffer).
            </p>
          </PrefField>

          <PrefField label="Stagger between buys">
            <div className="grid grid-cols-4 gap-0.5 rounded-md bg-bg-sunken p-0.5">
              {STAGGER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => patch('staggerMs', opt.value)}
                  aria-pressed={s.staggerMs === opt.value}
                  className={cn(
                    'rounded px-1.5 py-1 text-[10px] font-medium transition-colors',
                    s.staggerMs === opt.value
                      ? 'bg-bg-raised text-fg-primary'
                      : 'text-fg-muted hover:text-fg-secondary',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-fg-muted">
              Delay between sequential transactions when multi-wallet batch execution runs.
            </p>
          </PrefField>
        </div>

        <div className="border-t border-border-subtle p-3">
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
