'use client';

import { useEffect, useState } from 'react';
import { ArrowDownUp, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const TABS = ['Convert', 'Deposit', 'Buy'] as const;

type PerpsExchangeModalProps = {
  open: boolean;
  onClose: () => void;
  defaultTab?: (typeof TABS)[number];
};

export function PerpsExchangeModal({ open, onClose, defaultTab = 'Deposit' }: PerpsExchangeModalProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]>(defaultTab);
  const [fromAmt, setFromAmt] = useState('');
  const [toAmt, setToAmt] = useState('');

  useEffect(() => {
    if (open) setTab(defaultTab);
  }, [open, defaultTab]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[560] flex animate-in fade-in items-center justify-center bg-black/70 p-4 duration-200">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Dismiss"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="perps-exchange-title"
        className="relative flex max-h-[90vh] w-full max-w-md animate-in zoom-in-95 fade-in flex-col overflow-hidden rounded-md border border-border-subtle bg-bg-raised shadow-lg duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 id="perps-exchange-title" className="text-sm font-semibold text-fg-primary">
            Exchange
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-press focus-ring rounded-sm p-1 text-fg-muted hover:text-fg-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="flex items-center gap-1 border-b border-border-subtle pb-2">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-sm px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  tab === t ? 'bg-bg-hover text-fg-primary' : 'text-fg-muted hover:text-fg-secondary',
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'Convert' ? (
            <div className="mt-3 space-y-3">
              <p className="text-[11px] text-fg-muted">Swap SOL for USDC on Hyperliquid</p>
              <div className="rounded-md border border-border-subtle bg-bg-sunken/60 p-3">
                <div className="flex items-center justify-between text-[10px] text-fg-muted">
                  <span>Converting</span>
                  <span className="tabular-nums">Bal 0.00</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={fromAmt}
                    onChange={(e) => setFromAmt(e.target.value)}
                    placeholder="0.0"
                    className="min-w-0 flex-1 bg-transparent text-lg font-semibold tabular-nums text-fg-primary outline-none placeholder:text-fg-muted/50"
                  />
                  <span className="rounded-sm border border-border-subtle bg-bg-hover px-2 py-0.5 text-[10px] font-semibold text-fg-secondary">
                    SOL
                  </span>
                </div>
              </div>
              <div className="flex justify-center">
                <span className="rounded-sm border border-border-subtle bg-bg-sunken p-1 text-fg-muted">
                  <ArrowDownUp className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="rounded-md border border-border-subtle bg-bg-sunken/60 p-3">
                <div className="flex items-center justify-between text-[10px] text-fg-muted">
                  <span>Gaining</span>
                  <span className="tabular-nums">Bal 0.00</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={toAmt}
                    onChange={(e) => setToAmt(e.target.value)}
                    placeholder="0.0"
                    className="min-w-0 flex-1 bg-transparent text-lg font-semibold tabular-nums text-fg-primary outline-none placeholder:text-fg-muted/50"
                  />
                  <span className="rounded-sm border border-border-subtle bg-bg-hover px-2 py-0.5 text-[10px] font-semibold text-fg-secondary">
                    USDC
                  </span>
                </div>
              </div>
              <p className="text-center text-[10px] tabular-nums text-fg-muted">1 SOL ≈ — USDC</p>
            </div>
          ) : null}

          {tab === 'Deposit' ? (
            <div className="mt-3 space-y-2.5 text-xs leading-relaxed text-fg-secondary">
              <p>Fund your Hyperliquid perps account to place trades.</p>
              <ul className="space-y-1 rounded-md border border-border-subtle bg-bg-sunken/40 px-3 py-2.5 text-[11px] text-fg-muted">
                <li>Bridge USDC to Hyperliquid L1</li>
                <li>Or deposit from your connected Solana wallet</li>
              </ul>
              <p className="text-[10px] text-fg-muted">Wallet signing + HL deposit rail ships next.</p>
            </div>
          ) : null}

          {tab === 'Buy' ? (
            <div className="mt-3 space-y-2.5 text-xs leading-relaxed text-fg-secondary">
              <p>Buy crypto with card or bank, then convert to USDC for perps margin.</p>
              <p className="rounded-md border border-border-subtle bg-bg-sunken/40 px-3 py-2.5 text-[10px] text-fg-muted">
                On-ramp integration uses your existing Pointer wallet flow.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border-subtle px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-press focus-ring rounded-sm border border-border-subtle px-3 py-1.5 text-xs font-medium text-fg-secondary hover:bg-bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-press focus-ring rounded-sm bg-accent-primary px-3 py-1.5 text-xs font-medium text-fg-inverse hover:brightness-110"
          >
            {tab === 'Deposit' ? 'Continue to deposit' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
