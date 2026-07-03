'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useWalletQuickBuyStore } from '@/store/walletQuickBuy';

const PRESETS = [0.1, 0.25, 0.5, 1, 2, 5];

/** Toolbar pill to pick the quick-buy SOL amount used by the trades feed (Axiom "⚡ N"). */
export function WalletQuickBuyAmount() {
  const amountSol = useWalletQuickBuyStore((s) => s.amountSol);
  const setAmount = useWalletQuickBuyStore((s) => s.setAmount);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const W = 212;
    setPos({ left: Math.min(Math.max(8, r.left), window.innerWidth - W - 8), top: r.bottom + 6 });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-wqb]')) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const customValid = Number.isFinite(Number(custom)) && Number(custom) > 0;
  const applyCustom = () => {
    if (!customValid) return;
    setAmount(Number(custom));
    setCustom('');
    setOpen(false);
  };

  return (
    <>
      <button
        ref={ref}
        type="button"
        data-no-drag
        data-wqb
        onClick={() => setOpen((v) => !v)}
        title="Quick-buy amount"
        className={cn(
          'btn-press flex h-[26px] shrink-0 items-center gap-1 rounded-md border border-accent-primary/30 bg-accent-primary/[0.1] px-2 text-[11px] font-bold tabular-nums text-accent-primary transition-colors hover:bg-accent-primary/[0.18]',
        )}
      >
        <Zap className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        {amountSol}
      </button>
      {open && pos && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-wqb
              className="fixed z-[260] w-[212px] overflow-hidden rounded-xl border border-border-subtle bg-bg-raised p-2.5 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.85)]"
              style={{ left: pos.left, top: pos.top }}
            >
              <div className="mb-2 flex items-center justify-between px-0.5">
                <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-fg-secondary">
                  <Zap className="h-3.5 w-3.5 text-accent-primary" strokeWidth={2.5} aria-hidden />
                  Quick Buy
                </span>
                <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-fg-muted">
                  SOL
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {PRESETS.map((p) => {
                  const on = amountSol === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setAmount(p);
                        setOpen(false);
                      }}
                      className={cn(
                        'btn-press rounded-lg border py-1.5 text-[12px] font-semibold tabular-nums transition',
                        on
                          ? 'border-accent-primary/50 bg-accent-primary/15 text-accent-primary'
                          : 'border-border-subtle bg-bg-sunken text-fg-secondary hover:border-white/20 hover:bg-bg-hover hover:text-fg-primary',
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <div className="relative min-w-0 flex-1">
                  <input
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applyCustom();
                    }}
                    inputMode="decimal"
                    placeholder="Custom"
                    className="w-full rounded-lg border border-border-subtle bg-bg-sunken py-1.5 pl-2.5 pr-9 text-[12px] tabular-nums text-fg-primary outline-none transition-colors placeholder:text-fg-muted focus:border-accent-primary/50"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wider text-fg-muted">
                    SOL
                  </span>
                </div>
                <button
                  type="button"
                  onClick={applyCustom}
                  disabled={!customValid}
                  className="btn-press shrink-0 rounded-lg bg-accent-primary px-3 py-1.5 text-[11px] font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Set
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
