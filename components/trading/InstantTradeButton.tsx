'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Trash2, Zap, X } from 'lucide-react';
import { toast } from 'sonner';
import { BUY_PRESETS_SOL } from '@/lib/utils/constants';
import { explorerAddressUrl, isValidPublicKey, shortenAddress } from '@/lib/utils/addresses';
import {
  TON_DEMO_JETTON_A,
  TON_DEMO_JETTON_B,
  TON_NATIVE_UI_MINT,
} from '@/lib/utils/tonDemoMints';
import { cn } from '@/lib/utils/cn';
import { useRecentTradeMintsStore } from '@/store/recentTradeMints';

const SHORTCUTS = [
  { label: 'TON', mint: TON_NATIVE_UI_MINT },
  { label: 'USDT', mint: TON_DEMO_JETTON_A },
  { label: 'ADDR', mint: TON_DEMO_JETTON_B },
] as const;

const SELL_PCTS = [25, 50, 75, 100] as const;

type TradeSideUi = 'buy' | 'sell';

export function InstantTradeButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<TradeSideUi>('buy');
  const [mintInput, setMintInput] = useState('');
  const [buySolAttach, setBuySolAttach] = useState<number | null>(null);
  const [buySolCustom, setBuySolCustom] = useState('');
  const [sellPctAttach, setSellPctAttach] = useState<number | null>(100);
  const mintFieldRef = useRef<HTMLInputElement>(null);

  const recents = useRecentTradeMintsStore((s) => s.mints);
  const clearRecents = useRecentTradeMintsStore((s) => s.clearRecents);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => mintFieldRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function resolvedBuySol(): number | null {
    if (buySolAttach != null && Number.isFinite(buySolAttach) && buySolAttach > 0) {
      return buySolAttach;
    }
    const n = parseFloat(buySolCustom);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function goToToken() {
    const raw = mintInput.trim();
    if (!isValidPublicKey(raw)) {
      toast.error('Invalid mint', { description: 'Paste a valid TON jetton master or wallet address.' });
      return;
    }
    if (side === 'buy') {
      const sol = resolvedBuySol();
      const q =
        sol != null && Number.isFinite(sol) && sol > 0
          ? `?buySol=${encodeURIComponent(String(sol))}`
          : '';
      setOpen(false);
      setMintInput('');
      setBuySolAttach(null);
      setBuySolCustom('');
      router.push(`/token/${encodeURIComponent(raw)}${q}`);
      return;
    }
    setOpen(false);
    setMintInput('');
    router.push(`/token/${encodeURIComponent(raw)}?tradeTab=sell`);
  }

  function shortcutHref(mint: string) {
    if (side === 'buy') {
      const sol = resolvedBuySol();
      const q =
        sol != null && Number.isFinite(sol) && sol > 0
          ? `?buySol=${encodeURIComponent(String(sol))}`
          : '';
      return `/token/${encodeURIComponent(mint)}${q}`;
    }
    return `/token/${encodeURIComponent(mint)}?tradeTab=sell`;
  }

  return (
    <>
      <button
        type="button"
        data-onboarding="instant-trade"
        onClick={() => setOpen(true)}
        className={cn(
          'btn-press focus-ring fixed right-3 z-[45] flex h-11 w-11 items-center justify-center rounded-full border border-accent-primary/40 bg-accent-primary/90 text-fg-inverse shadow-lg transition-all duration-150 hover:bg-accent-primary sm:right-4',
          'bottom-[calc(var(--app-bottombar-h)+0.5rem)]',
        )}
        aria-label="Quick trade"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Zap className="h-5 w-5" strokeWidth={2.25} />
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[55] flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Close quick trade"
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              'relative z-10 flex max-h-[min(88vh,680px)] w-full max-w-md flex-col border border-border-subtle bg-bg-base shadow-xl',
              'rounded-t-2xl sm:rounded-lg',
            )}
            role="dialog"
            aria-modal="true"
            aria-labelledby="instant-trade-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
              <span id="instant-trade-title" className="text-sm font-semibold text-fg-primary">
                Quick trade
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-press rounded p-1 text-fg-muted hover:text-fg-primary"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
              <div className="flex rounded-md border border-border-subtle p-0.5">
                <button
                  type="button"
                  onClick={() => setSide('buy')}
                  className={cn(
                    'flex-1 rounded-sm py-1.5 text-center text-[12px] font-semibold transition',
                    side === 'buy'
                      ? 'bg-accent-primary text-fg-inverse'
                      : 'text-fg-muted hover:text-fg-secondary',
                  )}
                >
                  Buy
                </button>
                <button
                  type="button"
                  onClick={() => setSide('sell')}
                  className={cn(
                    'flex-1 rounded-sm py-1.5 text-center text-[12px] font-semibold transition',
                    side === 'sell'
                      ? 'bg-signal-bear/90 text-fg-inverse'
                      : 'text-fg-muted hover:text-fg-secondary',
                  )}
                >
                  Sell
                </button>
              </div>

              <p className="mt-3 text-[11px] leading-snug text-fg-secondary">
                {side === 'buy'
                  ? 'Open the token page with optional TON size pre-filled. USD sizing on-chart is next; you always sign with Privy on the token screen.'
                  : 'Jump to the token on the Sell tab. Set percent chips here for your workflow (full % routing on-token is expanding).'}
              </p>

              <div className="mt-3 space-y-2">
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                  Token mint
                </label>
                <div className="flex gap-2">
                  <input
                    ref={mintFieldRef}
                    type="text"
                    value={mintInput}
                    onChange={(e) => setMintInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        goToToken();
                      }
                    }}
                    placeholder="Contract address (CA)"
                    spellCheck={false}
                    autoComplete="off"
                    className="focus-ring min-w-0 flex-1 rounded-md border border-border-subtle bg-bg-base px-2.5 py-2 tabular-nums text-[12px] text-fg-primary placeholder:text-fg-muted"
                  />
                  <button
                    type="button"
                    onClick={() => goToToken()}
                    className={cn(
                      'btn-press shrink-0 rounded-md px-3 py-2 text-xs font-semibold',
                      side === 'buy' ? 'bg-accent-primary text-fg-inverse' : 'bg-signal-bear/90 text-fg-inverse',
                    )}
                  >
                    Open
                  </button>
                </div>

                {side === 'buy' ? (
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                      Size (TON)
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setBuySolAttach(null);
                          setBuySolCustom('');
                        }}
                        className={cn(
                          'btn-press rounded-full border px-2 py-0.5 tabular-nums text-[10px] font-semibold tabular-nums',
                          buySolAttach === null && buySolCustom === ''
                            ? 'border-accent-primary/50 text-accent-primary'
                            : 'border-border-subtle text-fg-muted hover:border-border-default',
                        )}
                      >
                        None
                      </button>
                      {BUY_PRESETS_SOL.map((sol) => (
                        <button
                          key={sol}
                          type="button"
                          onClick={() => {
                            setBuySolAttach(sol);
                            setBuySolCustom('');
                          }}
                          className={cn(
                            'btn-press rounded-full border px-2 py-0.5 tabular-nums text-[10px] font-semibold tabular-nums',
                            buySolAttach === sol
                              ? 'border-accent-primary/50 text-accent-primary'
                              : 'border-border-subtle text-fg-muted hover:border-border-default',
                          )}
                        >
                          {sol}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={buySolCustom}
                      onChange={(e) => {
                        setBuySolCustom(e.target.value);
                        setBuySolAttach(null);
                      }}
                      placeholder="Custom TON amount"
                      className="focus-ring mt-2 w-full rounded-md border border-border-subtle bg-bg-base px-2.5 py-2 tabular-nums text-[12px] text-fg-primary placeholder:text-fg-muted"
                    />
                  </div>
                ) : (
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                      Sell portion (reference)
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {SELL_PCTS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setSellPctAttach(p)}
                          className={cn(
                            'btn-press rounded-full border px-2 py-0.5 tabular-nums text-[10px] font-semibold tabular-nums',
                            sellPctAttach === p
                              ? 'border-signal-bear/60 text-signal-bear'
                              : 'border-border-subtle text-fg-muted hover:border-border-default',
                          )}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {recents.length > 0 ? (
                <div className="mt-4 border-t border-border-subtle pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                      Recent
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        clearRecents();
                        toast.message('Recent tokens cleared');
                      }}
                      className="btn-press flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-fg-muted hover:text-signal-bear"
                      aria-label="Clear recent tokens"
                    >
                      <Trash2 className="h-3 w-3" />
                      Clear
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {recents.map((m) => (
                      <li key={m} className="flex items-center gap-2">
                        <Link
                          href={shortcutHref(m)}
                          onClick={() => setOpen(false)}
                          className="focus-ring min-w-0 flex-1 truncate rounded px-1 py-1 tabular-nums text-[11px] text-fg-secondary hover:bg-bg-hover hover:text-fg-primary"
                        >
                          {shortenAddress(m, 5)}
                        </Link>
                        <a
                          href={explorerAddressUrl(m)}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 rounded p-1 text-fg-muted hover:text-fg-secondary"
                          aria-label="TON explorer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-4 border-t border-border-subtle pt-3">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                  Shortcuts
                </span>
                <div className="mt-2 flex flex-col gap-2">
                  {SHORTCUTS.map(({ label, mint }) => (
                    <Link
                      key={mint}
                      href={shortcutHref(mint)}
                      onClick={() => setOpen(false)}
                      className="btn-press flex items-center justify-center rounded-md bg-accent-primary/15 py-2.5 text-center text-sm font-medium text-accent-primary hover:bg-accent-primary/25"
                    >
                      Trade {label}
                    </Link>
                  ))}
                  <Link
                    href="/pulse"
                    onClick={() => setOpen(false)}
                    className="btn-press border border-border-subtle py-2.5 text-center text-sm font-medium text-fg-secondary hover:bg-bg-hover"
                  >
                    Open Pulse feed
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
