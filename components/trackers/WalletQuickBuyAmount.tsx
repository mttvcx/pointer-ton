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
    const W = 168;
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
              className="fixed z-[260] w-[168px] rounded-lg border border-white/[0.1] bg-[#0a0a0a] p-1.5 shadow-2xl shadow-black/60"
              style={{ left: pos.left, top: pos.top }}
            >
              <div className="mb-1 px-1 text-[9px] font-semibold uppercase tracking-wide text-fg-muted">Quick buy · SOL</div>
              <div className="grid grid-cols-3 gap-1">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setAmount(p);
                      setOpen(false);
                    }}
                    className={cn(
                      'btn-press rounded-md py-1 text-[11px] font-semibold tabular-nums transition-colors',
                      amountSol === p
                        ? 'bg-accent-primary/25 text-accent-primary'
                        : 'bg-white/[0.04] text-fg-secondary hover:bg-white/[0.08] hover:text-fg-primary',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex items-center gap-1">
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const n = Number(custom);
                      if (Number.isFinite(n) && n > 0) {
                        setAmount(n);
                        setCustom('');
                        setOpen(false);
                      }
                    }
                  }}
                  inputMode="decimal"
                  placeholder="Custom"
                  className="min-w-0 flex-1 rounded-md border border-white/[0.1] bg-white/[0.03] px-2 py-1 text-[11px] tabular-nums text-fg-primary outline-none placeholder:text-fg-muted focus:border-accent-primary/40"
                />
                <button
                  type="button"
                  onClick={() => {
                    const n = Number(custom);
                    if (Number.isFinite(n) && n > 0) {
                      setAmount(n);
                      setCustom('');
                      setOpen(false);
                    }
                  }}
                  className="btn-press rounded-md bg-accent-primary/20 px-2 py-1 text-[11px] font-bold text-accent-primary hover:bg-accent-primary/30"
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
