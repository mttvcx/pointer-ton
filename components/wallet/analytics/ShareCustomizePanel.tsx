'use client';

import type { ShareOverlaySettings } from '@/lib/share/types';
import { cn } from '@/lib/utils/cn';

export function ShareCustomizePanel({
  overlay,
  onChange,
  onReset,
}: {
  overlay: ShareOverlaySettings;
  onChange: (p: Partial<ShareOverlaySettings>) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-medium text-fg-muted">Overlay options</h4>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] font-medium text-fg-secondary hover:text-fg-primary"
        >
          Reset
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ToggleRow
          label="Token name"
          on={overlay.showTokenName}
          onToggle={() => onChange({ showTokenName: !overlay.showTokenName })}
        />
        <ToggleRow
          label="Wallet label"
          on={overlay.showWalletLabel}
          onToggle={() => onChange({ showWalletLabel: !overlay.showWalletLabel })}
        />
        <ToggleRow
          label="Wallet address"
          on={overlay.showWalletAddress}
          onToggle={() => onChange({ showWalletAddress: !overlay.showWalletAddress })}
        />
        <ToggleRow
          label="Pointer branding"
          on={overlay.showBranding}
          onToggle={() => onChange({ showBranding: !overlay.showBranding })}
        />
        <ToggleRow
          label="Cashback footer"
          on={overlay.showCashbackFooter}
          onToggle={() => onChange({ showCashbackFooter: !overlay.showCashbackFooter })}
        />
        <ToggleRow
          label="Compact stats"
          on={overlay.compactStats}
          onToggle={() => onChange({ compactStats: !overlay.compactStats })}
        />
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
                'rounded-sm border px-3 py-1.5 text-[11px] font-medium transition',
                overlay.pnlFormat === m
                  ? 'border-border-default bg-bg-hover text-fg-primary'
                  : 'border-border-subtle text-fg-muted hover:border-border-default hover:text-fg-secondary',
              )}
            >
              {m === 'both' ? 'Amount + %' : m === 'pct' ? '% only' : 'Amount'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-fg-muted">
          <span>Overlay intensity</span>
          <span>{Math.round(overlay.overlayOpacity * 100)}%</span>
        </div>
        <input
          type="range"
          min={0.2}
          max={0.85}
          step={0.01}
          value={overlay.overlayOpacity}
          onChange={(e) => onChange({ overlayOpacity: Number(e.target.value) })}
          className="mt-1 w-full accent-emerald-400"
        />
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-fg-muted">
          <span>Text size</span>
          <span>{overlay.textScale.toFixed(2)}×</span>
        </div>
        <input
          type="range"
          min={0.85}
          max={1.2}
          step={0.01}
          value={overlay.textScale}
          onChange={(e) => onChange({ textScale: Number(e.target.value) })}
          className="mt-1 w-full accent-emerald-400"
        />
      </div>

      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">Accent</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(['teal', 'purple', 'blue', 'green'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onChange({ accent: a })}
              className={cn(
                'h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-bg-sunken',
                overlay.accent === a ? 'ring-white' : 'ring-transparent',
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
                'rounded-sm border px-3 py-1.5 text-[11px] font-medium capitalize',
                overlay.overlayAlign === a
                  ? 'border-border-default bg-bg-hover text-fg-primary'
                  : 'border-border-subtle text-fg-muted',
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
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
      className="flex items-center justify-between rounded-sm border border-border-subtle bg-bg-base px-3 py-2 text-left text-[12px] text-fg-secondary transition hover:bg-bg-hover"
    >
      {label}
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
          on ? 'bg-bg-hover text-fg-primary' : 'bg-bg-sunken text-fg-muted',
        )}
      >
        {on ? 'On' : 'Off'}
      </span>
    </button>
  );
}
