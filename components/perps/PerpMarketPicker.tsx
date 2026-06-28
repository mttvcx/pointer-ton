'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { fmtPerpUsdCompact } from '@/lib/hyperliquid/markets';
import type { PerpMarket } from '@/lib/perps/types';
import { formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayPanelClasses } from '@/lib/ui/overlayMotion';

function PerpIcon({ src, coin, size = 24 }: { src: string; coin: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-sunken text-fg-secondary ring-1 ring-border-subtle"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {failed || !src ? (
        <span className="font-bold leading-none" style={{ fontSize: Math.round(size * 0.36) }}>
          {coin.slice(0, 3).toUpperCase()}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size - 4}
          height={size - 4}
          className="object-contain"
          draggable={false}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

export function PerpMarketPicker({
  markets = [],
  selectedId,
  onSelect,
}: {
  markets?: PerpMarket[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { mounted, visible } = useOverlayPresence(open);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const openPicker = () => {
    setRect(buttonRef.current?.getBoundingClientRect() ?? null);
    setOpen(true);
  };

  const selected = markets.find((m) => m.id === selectedId) ?? markets[0]!;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return markets;
    return markets.filter(
      (m) =>
        m.coin.toLowerCase().includes(q) ||
        m.label.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q),
    );
  }, [markets, query]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  // Keep the dropdown pinned under the button on scroll/resize (Axiom-style anchor).
  useEffect(() => {
    if (!open) return;
    const update = () => setRect(buttonRef.current?.getBoundingClientRect() ?? null);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  const dec = selected.mark > 500 ? (selected.mark > 5000 ? 0 : 1) : 2;

  const dropdownStyle = useMemo(() => {
    if (!rect) return undefined;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const width = Math.min(620, vw - 24);
    let left = rect.left;
    if (left + width > vw - 12) left = Math.max(12, vw - width - 12);
    return { top: Math.round(rect.bottom + 6), left: Math.round(left), width };
  }, [rect]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={openPicker}
        className="group flex min-w-0 items-center gap-2 rounded-lg border border-border-subtle bg-bg-sunken/60 px-2 py-1.5 text-left transition hover:border-border hover:bg-bg-hover"
        aria-label="Select perpetual market"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <PerpIcon src={selected.iconSrc} coin={selected.coin} size={28} />
        <span className="min-w-0">
          <span className="flex items-center gap-1">
            <span className="text-[13px] font-semibold tracking-tight text-fg-primary">{selected.coin}</span>
            <ChevronDown className="h-3.5 w-3.5 text-fg-muted transition group-hover:text-fg-secondary" />
          </span>
          <span className="mt-0.5 block text-[10px] tabular-nums text-fg-muted">
            ${formatNumber(selected.mark, { decimals: dec })}
          </span>
        </span>
      </button>

      {mounted && dropdownStyle ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[899] cursor-default"
            aria-label="Dismiss"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Select market"
            className={cn(
              'fixed z-[900] flex max-h-[min(72vh,540px)] flex-col overflow-hidden rounded-xl border border-border-subtle',
              'bg-bg-raised shadow-[0_32px_80px_-24px_rgba(0,0,0,0.92)]',
              overlayPanelClasses(visible),
              'fill-mode-forwards',
            )}
            style={dropdownStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2.5">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-subtle bg-bg-sunken px-2.5 py-2">
                <Search className="h-4 w-4 shrink-0 text-fg-muted" strokeWidth={2} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search coins..."
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-fg-primary outline-none placeholder:text-fg-muted/70"
                />
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted transition hover:bg-white/[0.06] hover:text-fg-primary"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))] gap-2 border-b border-border-subtle bg-bg-raised px-3 py-2 text-[9px] font-semibold uppercase tracking-wide text-fg-muted">
                <span>Token</span>
                <span className="text-right">Last price</span>
                <span className="text-right">24h change</span>
                <span className="text-right">8h funding</span>
                <span className="text-right">24h volume</span>
                <span className="text-right">Open interest</span>
              </div>
              {filtered.length === 0 ? (
                <p className="px-4 py-8 text-center text-[12px] text-fg-muted">No markets match your search.</p>
              ) : (
                filtered.map((m) => {
                  const on = m.id === selectedId;
                  const priceDec = m.mark > 500 ? (m.mark > 5000 ? 0 : 1) : 2;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onSelect(m.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'grid w-full grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))] gap-2 border-b border-border-subtle/60 px-3 py-2.5 text-left transition',
                        on ? 'bg-accent-primary/10' : 'hover:bg-bg-hover',
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <PerpIcon src={m.iconSrc} coin={m.coin} size={22} />
                        <span className="min-w-0 truncate">
                          <span className="text-[12px] font-semibold text-fg-primary">{m.coin}</span>
                          <span className="ml-1.5 text-[10px] font-medium text-fg-muted">{m.maxLeverage}x</span>
                        </span>
                      </span>
                      <span className="self-center text-right text-[11px] font-semibold tabular-nums text-fg-primary">
                        {formatNumber(m.mark, { decimals: priceDec })}
                      </span>
                      <span
                        className={cn(
                          'self-center text-right text-[11px] font-semibold tabular-nums',
                          m.chg24 >= 0 ? 'text-signal-bull' : 'text-signal-bear',
                        )}
                      >
                        {m.chg24 >= 0 ? '+' : ''}
                        {m.chg24.toFixed(2)}%
                      </span>
                      <span className="self-center text-right text-[11px] tabular-nums text-fg-secondary">
                        {m.fundingApr.toFixed(2)}%
                      </span>
                      <span className="self-center text-right text-[11px] tabular-nums text-fg-secondary">
                        {fmtPerpUsdCompact(m.vol24Usd)}
                      </span>
                      <span className="self-center text-right text-[11px] tabular-nums text-fg-secondary">
                        {fmtPerpUsdCompact(m.oiUsd)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
