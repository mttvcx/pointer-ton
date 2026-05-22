'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Z_BOTTOM_BAR_POPOVER } from '@/lib/ui/zLayers';
import { useTradingStore, type PresetSlot } from '@/store/trading';

interface TradingSettingsPopoverProps {
  /** Styles on the real `<button>` trigger (avoid `display:contents`, which breaks clicks in some browsers). */
  className?: string;
  children: React.ReactNode;
}

const PANEL_W = 384;
const PANEL_GAP = 8;

/**
 * Visual stub for trading settings opened from the PRESET chip. PRESET tabs
 * sync with `useTradingStore.activePresetSlot`; form fields are local-only.
 */
export function TradingSettingsPopover({ className, children }: TradingSettingsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ left: number; bottom: number } | null>(null);
  const activeSlot = useTradingStore((s) => s.activePresetSlot);
  const setActiveSlot = useTradingStore((s) => s.setActivePresetSlot);
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [slippage, setSlippage] = useState('99');
  const [priority, setPriority] = useState('0.001');
  const [bribe, setBribe] = useState('0.004');
  const [autoFee, setAutoFee] = useState(false);
  const [maxFee, setMaxFee] = useState('0.1');
  const [mev, setMev] = useState<'off' | 'reduced' | 'secure'>('reduced');
  const [rpc, setRpc] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const vw = window.innerWidth;
      const left = Math.min(Math.max(8, r.left), Math.max(8, vw - PANEL_W - 8));
      const bottom = window.innerHeight - r.top + PANEL_GAP;
      setCoords({ left, bottom });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(className)}
      >
        {children}
      </button>

      {mounted && open && coords
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Trading Settings"
              style={{
                position: 'fixed',
                left: `${coords.left}px`,
                bottom: `${coords.bottom}px`,
                width: `${PANEL_W}px`,
              }}
              className={cn(
                Z_BOTTOM_BAR_POPOVER,
                'rounded-lg border border-border-subtle bg-bg-raised p-4 shadow-2xl',
              )}
            >
              <header className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-fg-primary">Trading Settings</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded p-1 text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </header>

              <div className="mb-3 flex gap-1 rounded bg-bg-sunken p-0.5">
                {([1, 2, 3] as const).map((p: PresetSlot) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setActiveSlot(p)}
                    className={cn(
                      'btn-press h-7 flex-1 rounded px-2 text-[11px] font-semibold transition-colors',
                      activeSlot === p
                        ? 'bg-accent-primary text-fg-inverse'
                        : 'text-fg-muted hover:text-fg-primary',
                    )}
                  >
                    PRESET {p}
                  </button>
                ))}
              </div>

              <div className="mb-3 flex gap-1">
                <button
                  type="button"
                  onClick={() => setTab('buy')}
                  className={cn(
                    'btn-press h-8 flex-1 rounded text-xs font-semibold transition-colors',
                    tab === 'buy'
                      ? 'bg-signal-bull/15 text-signal-bull'
                      : 'bg-bg-sunken text-fg-muted hover:text-fg-primary',
                  )}
                >
                  Buy Settings
                </button>
                <button
                  type="button"
                  onClick={() => setTab('sell')}
                  className={cn(
                    'btn-press h-8 flex-1 rounded text-xs font-semibold transition-colors',
                    tab === 'sell'
                      ? 'bg-signal-bear/15 text-signal-bear'
                      : 'bg-bg-sunken text-fg-muted hover:text-fg-primary',
                  )}
                >
                  Sell Settings
                </button>
              </div>

              <div className="mb-3 grid grid-cols-3 gap-2">
                <NumberField label="Slippage" unit="%" value={slippage} onChange={setSlippage} />
                <NumberField label="Priority" value={priority} onChange={setPriority} />
                <NumberField label="Bribe" value={bribe} onChange={setBribe} />
              </div>

              <div className="mb-3 flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-fg-secondary">
                  <input
                    type="checkbox"
                    checked={autoFee}
                    onChange={(e) => setAutoFee(e.target.checked)}
                    className="accent-accent-primary"
                  />
                  Auto Fee
                </label>
                <div className="flex-1">
                  <NumberField label="Max Fee" value={maxFee} onChange={setMaxFee} />
                </div>
              </div>

              <div className="mb-3">
                <div className="mb-1.5 text-[10px] uppercase tracking-wider text-fg-muted">
                  MEV Mode
                </div>
                <div className="flex gap-1">
                  {(['off', 'reduced', 'secure'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setMev(mode)}
                      className={cn(
                        'btn-press h-7 flex-1 rounded px-2 text-[11px] capitalize transition-colors',
                        mev === mode
                          ? 'bg-accent-primary/15 text-accent-primary'
                          : 'bg-bg-sunken text-fg-secondary hover:bg-bg-hover hover:text-fg-primary',
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <div className="mb-1.5 text-[10px] uppercase tracking-wider text-fg-muted">
                  RPC
                </div>
                <input
                  type="text"
                  value={rpc}
                  onChange={(e) => setRpc(e.target.value)}
                  placeholder="https://...e.com"
                  className="h-8 w-full rounded border border-border-subtle bg-bg-sunken px-2.5 text-xs text-fg-primary placeholder:text-fg-muted focus:border-accent-primary/50 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-press h-9 w-full rounded bg-accent-primary text-sm font-semibold text-fg-inverse transition-colors hover:bg-accent-glow"
              >
                Continue
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function NumberField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block rounded bg-bg-sunken px-2 py-1.5">
      <span className="block text-[9px] uppercase tracking-wider text-fg-muted">{label}</span>
      <span className="mt-0.5 flex items-baseline gap-0.5">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm font-semibold tabular-nums text-fg-primary focus:outline-none"
        />
        {unit ? <span className="text-[10px] text-fg-muted">{unit}</span> : null}
      </span>
    </label>
  );
}
