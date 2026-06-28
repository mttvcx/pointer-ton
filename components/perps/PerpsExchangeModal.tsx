'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, Check, Copy, ExternalLink, X } from 'lucide-react';
import { useWallets } from '@privy-io/react-auth';
import QRCode from 'react-qr-code';
import { HyperliquidPoweredBy } from '@/components/perps/HyperliquidWordmark';
import { cn } from '@/lib/utils/cn';

const TABS = ['Deposit', 'Convert', 'Buy'] as const;

type PerpsExchangeModalProps = {
  open: boolean;
  onClose: () => void;
  defaultTab?: (typeof TABS)[number];
};

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export function PerpsExchangeModal({ open, onClose, defaultTab = 'Deposit' }: PerpsExchangeModalProps) {
  const [tab, setTab] = useState<(typeof TABS)[number]>(defaultTab);
  const [fromAmt, setFromAmt] = useState('');
  const [copied, setCopied] = useState(false);
  const { wallets } = useWallets();

  /** Hyperliquid account == the user's EVM address (Privy embedded ethereum wallet). */
  const hlAddress = useMemo(() => {
    const embedded = wallets.find((w) => w.walletClientType === 'privy');
    return (embedded ?? wallets[0])?.address ?? null;
  }, [wallets]);

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

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  if (!open) return null;

  const copyAddress = () => {
    if (!hlAddress) return;
    navigator.clipboard?.writeText(hlAddress).then(
      () => setCopied(true),
      () => undefined,
    );
  };

  return (
    <div className="fixed inset-0 z-[560] flex animate-in fade-in items-center justify-center bg-black/70 p-4 duration-200">
      <button type="button" className="absolute inset-0" aria-label="Dismiss" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="perps-exchange-title"
        className="relative flex max-h-[90vh] w-full max-w-[420px] animate-in zoom-in-95 fade-in flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-raised shadow-2xl duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-3.5">
          <h2 id="perps-exchange-title" className="text-[15px] font-semibold text-fg-primary">
            Exchange
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-press focus-ring rounded-md p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Segmented tabs (Axiom-style pill group) */}
        <div className="mx-4 grid grid-cols-3 gap-1 rounded-lg border border-border-subtle bg-bg-sunken/60 p-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'rounded-md py-1.5 text-[12px] font-semibold transition-colors',
                tab === t ? 'bg-bg-hover text-fg-primary shadow-sm' : 'text-fg-muted hover:text-fg-secondary',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
          {tab === 'Deposit' ? (
            <div className="space-y-3.5">
              <p className="text-[12px] leading-relaxed text-fg-secondary">
                Send <span className="font-semibold text-fg-primary">USDC on Arbitrum</span> to your
                Hyperliquid account address below. It credits your perps margin once the bridge
                confirms.
              </p>

              {hlAddress ? (
                <>
                  <div className="flex justify-center rounded-lg border border-border-subtle bg-white p-3">
                    <QRCode value={hlAddress} size={148} bgColor="#ffffff" fgColor="#04050A" />
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                      Your Hyperliquid address
                    </span>
                    <button
                      type="button"
                      onClick={copyAddress}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg border border-border-subtle bg-bg-sunken/60 px-3 py-2.5 text-left transition-colors hover:bg-bg-hover"
                    >
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-primary">
                        {hlAddress}
                      </span>
                      {copied ? (
                        <Check className="h-4 w-4 shrink-0 text-signal-bull" />
                      ) : (
                        <Copy className="h-4 w-4 shrink-0 text-fg-muted" />
                      )}
                    </button>
                    <p className="mt-1.5 text-[10px] leading-snug text-fg-muted">
                      Arbitrum USDC only. Sending any other asset or network can lose funds.
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-border-subtle bg-bg-sunken/40 px-3 py-4 text-center text-[12px] text-fg-muted">
                  Connect your wallet to see your Hyperliquid deposit address.
                </div>
              )}

              <a
                href="https://app.hyperliquid.xyz/trade"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-accent-glow hover:underline"
              >
                Bridge USDC on Hyperliquid
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : null}

          {tab === 'Convert' ? (
            <div className="space-y-2.5">
              <p className="text-[12px] text-fg-secondary">
                Swap SOL to USDC, then deposit it to your Hyperliquid address.
              </p>
              <div className="rounded-lg border border-border-subtle bg-bg-sunken/60 p-3">
                <div className="flex items-center justify-between text-[10px] text-fg-muted">
                  <span>From</span>
                  <span className="tabular-nums">Balance —</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={fromAmt}
                    onChange={(e) => setFromAmt(e.target.value)}
                    placeholder="0.0"
                    inputMode="decimal"
                    className="min-w-0 flex-1 bg-transparent text-lg font-semibold tabular-nums text-fg-primary outline-none placeholder:text-fg-muted/50"
                  />
                  <span className="rounded-md border border-border-subtle bg-bg-hover px-2 py-1 text-[11px] font-semibold text-fg-secondary">
                    SOL
                  </span>
                </div>
              </div>
              <div className="flex justify-center">
                <span className="rounded-md border border-border-subtle bg-bg-sunken p-1.5 text-fg-muted">
                  <ArrowDownUp className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="rounded-lg border border-border-subtle bg-bg-sunken/60 p-3">
                <div className="flex items-center justify-between text-[10px] text-fg-muted">
                  <span>To (estimated)</span>
                  <span className="tabular-nums">Balance —</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-lg font-semibold tabular-nums text-fg-muted/60">—</span>
                  <span className="rounded-md border border-border-subtle bg-bg-hover px-2 py-1 text-[11px] font-semibold text-fg-secondary">
                    USDC
                  </span>
                </div>
              </div>
              <p className="text-[10px] leading-snug text-fg-muted">
                SOL→USDC routes through your Pointer wallet; the USDC→Hyperliquid bridge step ships
                with execution.
              </p>
            </div>
          ) : null}

          {tab === 'Buy' ? (
            <div className="space-y-2.5 text-[12px] leading-relaxed text-fg-secondary">
              <p>Buy USDC with card or bank through your existing Pointer on-ramp, then deposit it.</p>
              <div className="rounded-lg border border-border-subtle bg-bg-sunken/40 px-3 py-2.5 text-[11px] text-fg-muted">
                On-ramp uses the same provider as the rest of Pointer — funds land in your wallet,
                then convert + deposit to Hyperliquid.
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border-subtle px-4 py-3">
          <HyperliquidPoweredBy subtle />
          {tab === 'Deposit' ? (
            <button
              type="button"
              onClick={copyAddress}
              disabled={!hlAddress}
              className="btn-press focus-ring rounded-md bg-accent-primary px-3.5 py-1.5 text-xs font-semibold text-fg-inverse hover:brightness-110 disabled:opacity-50"
            >
              {copied ? 'Copied' : hlAddress ? `Copy ${shortAddr(hlAddress)}` : 'Copy address'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="btn-press focus-ring rounded-md border border-border-subtle px-3.5 py-1.5 text-xs font-medium text-fg-secondary hover:bg-bg-hover"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
