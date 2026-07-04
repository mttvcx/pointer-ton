'use client';

import type { ShareOverlaySettings } from '@/lib/share/types';
import { cn } from '@/lib/utils/cn';

export function ShareCustomizePanel({
  overlay,
  onChange,
  onReset,
  hasCalendarData = false,
}: {
  overlay: ShareOverlaySettings;
  onChange: (p: Partial<ShareOverlaySettings>) => void;
  onReset: () => void;
  hasCalendarData?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">Card customization</h4>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] font-medium text-fg-secondary hover:text-fg-primary"
        >
          Reset defaults
        </button>
      </div>

      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">PnL format</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['amount', 'pct', 'both'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ pnlFormat: m })}
              className={cn(
                'rounded-md border px-3 py-1.5 text-[11px] font-medium backdrop-blur-md transition',
                overlay.pnlFormat === m
                  ? 'border-accent-primary/50 bg-accent-primary/10 text-fg-primary'
                  : 'border-white/10 bg-white/[0.05] text-fg-muted hover:border-white/20 hover:bg-white/[0.1] hover:text-fg-secondary',
              )}
            >
              {m === 'both' ? 'Amount + %' : m === 'pct' ? '% only' : 'Amount'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SliderRow
          label="Overlay intensity"
          value={overlay.overlayOpacity}
          display={`${Math.round(overlay.overlayOpacity * 100)}%`}
          min={0.15}
          max={0.85}
          step={0.01}
          onChange={(v) => onChange({ overlayOpacity: v })}
        />
        <SliderRow
          label="Text size"
          value={overlay.textScale}
          display={`${overlay.textScale.toFixed(2)}×`}
          min={0.85}
          max={1.2}
          step={0.01}
          onChange={(v) => onChange({ textScale: v })}
        />
      </div>

      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">Accent color</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['teal', 'purple', 'blue', 'green'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onChange({ accent: a })}
              aria-label={a}
              className={cn(
                'h-8 w-8 rounded-full ring-2 ring-inset transition',
                overlay.accent === a ? 'ring-white' : 'ring-transparent hover:ring-white/40',
                a === 'teal' && 'bg-teal-400',
                a === 'purple' && 'bg-violet-400',
                a === 'blue' && 'bg-sky-400',
                a === 'green' && 'bg-emerald-400',
              )}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">Overlay position</p>
        <div className="mt-2 flex gap-2">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onChange({ overlayAlign: a })}
              className={cn(
                'rounded-md border px-3 py-1.5 text-[11px] font-medium capitalize backdrop-blur-md transition',
                overlay.overlayAlign === a
                  ? 'border-accent-primary/50 bg-accent-primary/10 text-fg-primary'
                  : 'border-white/10 bg-white/[0.05] text-fg-muted hover:border-white/20 hover:bg-white/[0.1]',
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ToggleRow
          label="Wallet address"
          on={overlay.showWalletAddress}
          onToggle={() => onChange({ showWalletAddress: !overlay.showWalletAddress })}
        />
        {hasCalendarData ? (
          <ToggleRow
            label="PNL calendar"
            on={overlay.showCalendar}
            onToggle={() => onChange({ showCalendar: !overlay.showCalendar })}
          />
        ) : null}
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-fg-muted">
        <span>{label}</span>
        <span className="tabular-nums">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-accent-primary"
      />
    </div>
  );
}

function ToggleRow({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-3 py-2.5 text-left text-[12px] text-fg-secondary backdrop-blur-md transition hover:border-white/20 hover:bg-white/[0.09]"
    >
      {label}
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
          on ? 'bg-accent-primary/15 text-fg-primary' : 'bg-white/[0.08] text-fg-muted',
        )}
      >
        {on ? 'On' : 'Off'}
      </span>
    </button>
  );
}
