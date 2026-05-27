'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import type { MevMode } from '@/lib/trading/mevMode';
import { formatNumber, lamportsToSol } from '@/lib/utils/formatters';
import { useTradingStore, type PresetSlot } from '@/store/trading';
import { useUIStore } from '@/store/ui';
import { nativePriorityFeeDenomLabel, nativeTicker } from '@/lib/chains/nativeCurrency';

export type PresetTradeRow = {
  slot: PresetSlot;
  name: string;
  buy_amounts_sol: number[];
  slippage_bps: number;
  dynamic_slippage: boolean;
  mev_mode: MevMode;
  priority_fee_lamports: number;
  jito_tip_lamports: number;
  auto_fee: boolean;
  max_fee_sol: number;
};

type Props = {
  presets: PresetTradeRow[];
  disabled?: boolean;
};

function mevLabel(mode: MevMode): string {
  if (mode === 'reduced') return 'Red.';
  if (mode === 'secure') return 'Sec.';
  return 'Off';
}

function PresetInlineSettings({ preset }: { preset: PresetTradeRow }) {
  const { getAccessToken } = usePointerAuth();
  const qc = useQueryClient();
  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);
  const prioUnit = nativePriorityFeeDenomLabel(activeChain);
  const isSolTradingUi = activeChain === 'sol';

  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [slippagePct, setSlippagePct] = useState(String(preset.slippage_bps / 100));
  const [prioritySol, setPrioritySol] = useState(
    formatNumber(lamportsToSol(BigInt(preset.priority_fee_lamports)), { decimals: 5 }),
  );
  const [bribeSol, setBribeSol] = useState(
    formatNumber(lamportsToSol(BigInt(preset.jito_tip_lamports)), { decimals: 5 }),
  );
  const [autoFee, setAutoFee] = useState(preset.auto_fee);
  const [maxFeeSol, setMaxFeeSol] = useState(String(preset.max_fee_sol));
  const [mevMode, setMevMode] = useState<MevMode>(preset.mev_mode);
  const [buyChips, setBuyChips] = useState(preset.buy_amounts_sol.join(', '));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSlippagePct(String(preset.slippage_bps / 100));
    setPrioritySol(
      formatNumber(lamportsToSol(BigInt(preset.priority_fee_lamports)), { decimals: 5 }),
    );
    setBribeSol(formatNumber(lamportsToSol(BigInt(preset.jito_tip_lamports)), { decimals: 5 }));
    setAutoFee(preset.auto_fee);
    setMaxFeeSol(String(preset.max_fee_sol));
    setMevMode(preset.mev_mode);
    setBuyChips(preset.buy_amounts_sol.join(', '));
  }, [preset]);

  const save = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');

      const slip = Number(slippagePct.replace(/%/g, ''));
      if (!Number.isFinite(slip) || slip <= 0) throw new Error('slippage');

      const prioNative = Number(prioritySol);
      const bribeNative = Number(bribeSol);
      const maxNative = Number(maxFeeSol);
      if (!Number.isFinite(maxNative) || maxNative < 0.000001 || maxNative > 5) {
        throw new Error('max_fee');
      }

      const parts = buyChips
        .split(/[\s,]+/)
        .map((s) => Number.parseFloat(s))
        .filter((n) => Number.isFinite(n) && n > 0);

      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slot: preset.slot,
          name: preset.name,
          buy_amounts_sol: parts.length > 0 ? parts.slice(0, 8) : preset.buy_amounts_sol,
          slippage_bps: Math.min(5000, Math.max(1, Math.round(slip * 100))),
          dynamic_slippage: preset.dynamic_slippage,
          mev_mode: mevMode,
          priority_fee_lamports: Math.min(
            5_000_000,
            Math.max(0, Math.round(Number(prioNative) * 1e9)),
          ),
          jito_tip_lamports: Math.min(
            5_000_000,
            Math.max(0, Math.round(Number(bribeNative) * 1e9)),
          ),
          auto_fee: autoFee,
          max_fee_sol: maxNative,
        }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === 'object' && json && 'message' in json
            ? String((json as { message: unknown }).message)
            : 'Save failed';
        throw new Error(msg);
      }
      return json;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['trading-presets'] });
    },
    onError: () => {
      toast.error('Could not save preset');
    },
  });

  const queueSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void save.mutate();
    }, 650);
  }, [save]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  return (
    <div className="mt-2.5 space-y-2.5 rounded-md border border-border-subtle/50 bg-bg-hover/20 p-2.5">
      <div className="flex gap-1 border-b border-border-subtle/40 pb-0">
        <button
          type="button"
          onClick={() => setTab('buy')}
          className={cn(
            'px-2 pb-2 pt-0.5 text-[11px] font-semibold transition-colors',
            'border-b-2',
            tab === 'buy'
              ? 'border-signal-bull text-signal-bull'
              : 'border-transparent text-fg-muted hover:text-fg-secondary',
          )}
        >
          Buy settings
        </button>
        <button
          type="button"
          onClick={() => setTab('sell')}
          className={cn(
            'px-2 pb-2 pt-0.5 text-[11px] font-semibold transition-colors',
            'border-b-2',
            tab === 'sell'
              ? 'border-signal-bear text-signal-bear'
              : 'border-transparent text-fg-muted hover:text-fg-secondary',
          )}
        >
          Sell settings
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <MetricBox
          label="Slippage"
          unit="%"
          value={slippagePct}
          onChange={(v) => {
            setSlippagePct(v);
            queueSave();
          }}
        />
        <MetricBox
          label="Priority"
          value={prioritySol}
          onChange={(v) => {
            setPrioritySol(v);
            queueSave();
          }}
        />
        <MetricBox
          label="Bribe"
          value={bribeSol}
          onChange={(v) => {
            setBribeSol(v);
            queueSave();
          }}
        />
      </div>

      {tab === 'buy' ? (
        <label className="block space-y-1">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-fg-muted">
            Buy chips ({nativeSym})
          </span>
          <input
            value={buyChips}
            onChange={(e) => {
              setBuyChips(e.target.value);
              queueSave();
            }}
            className="focus-ring w-full rounded border border-border-subtle/60 bg-bg-sunken/50 px-2 py-1.5 text-[11px] tabular-nums text-fg-primary"
          />
        </label>
      ) : null}

      <div className="flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-fg-secondary">
          <input
            type="checkbox"
            checked={autoFee}
            onChange={(e) => {
              setAutoFee(e.target.checked);
              queueSave();
            }}
            className="h-3.5 w-3.5 rounded border-border-subtle [accent-color:var(--accent-primary)]"
          />
          Auto Fee
        </label>
        <div className="min-w-0 flex-1">
          <MetricBox
            label="Max Fee"
            value={maxFeeSol}
            onChange={(v) => {
              setMaxFeeSol(v);
              queueSave();
            }}
            compact
          />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-fg-muted">
          MEV Mode
          <Info className="h-3 w-3 opacity-60" aria-hidden />
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(['off', 'reduced', 'secure'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setMevMode(mode);
                queueSave();
              }}
              className={cn(
                'rounded border px-2 py-1.5 text-[10px] font-semibold transition-colors',
                mevMode === mode
                  ? 'border-sky-400/50 bg-sky-500/20 text-sky-100'
                  : 'border-border-subtle/60 text-fg-muted hover:border-border-subtle hover:text-fg-secondary',
              )}
            >
              {mevLabel(mode)}
            </button>
          ))}
        </div>
      </div>

      {!isSolTradingUi ? (
        <p className="text-[10px] leading-snug text-fg-muted">
          Priority / bribe fields apply on Solana; values stay in preset {preset.slot} on other chains.
        </p>
      ) : (
        <p className="text-[10px] leading-snug text-fg-muted">
          Priority cap uses {prioUnit} on RPC routes; bribe maps to Jito tip on reduced MEV.
        </p>
      )}
    </div>
  );
}

function MetricBox({
  label,
  unit,
  value,
  onChange,
  compact,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <label
      className={cn(
        'block rounded border border-border-subtle/60 bg-bg-sunken/50',
        compact ? 'px-2 py-1' : 'px-2 py-1.5',
      )}
    >
      <span className="block text-[8px] font-semibold uppercase tracking-wide text-fg-muted">
        {label}
      </span>
      <span className="mt-0.5 flex items-baseline gap-0.5">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full bg-transparent font-semibold tabular-nums text-fg-primary focus:outline-none',
            compact ? 'text-[11px]' : 'text-sm',
          )}
        />
        {unit ? <span className="text-[9px] text-fg-muted">{unit}</span> : null}
      </span>
    </label>
  );
}

/** Axiom-style preset row — tap to expand settings, tap again to collapse (stay selected). */
export function PresetTradePanel({ presets, disabled }: Props) {
  const { activePresetSlot, setActivePresetSlot } = useTradingStore();
  const [expandedSlot, setExpandedSlot] = useState<PresetSlot | null>(null);

  const expandedPreset = useMemo(
    () => presets.find((p) => p.slot === expandedSlot) ?? null,
    [presets, expandedSlot],
  );

  const onPresetClick = (slot: PresetSlot) => {
    if (disabled) return;
    if (expandedSlot === slot) {
      setExpandedSlot(null);
      return;
    }
    setActivePresetSlot(slot);
    setExpandedSlot(slot);
  };

  return (
    <div className="min-w-0 w-full">
      <div className="grid w-full grid-cols-3 gap-1.5">
        {([1, 2, 3] as const).map((slot) => {
          const isActive = activePresetSlot === slot;
          const isEditing = expandedSlot === slot;

          return (
            <button
              key={slot}
              type="button"
              disabled={disabled}
              title={presets.find((p) => p.slot === slot)?.name}
              aria-pressed={isActive}
              aria-expanded={isEditing}
              onClick={() => onPresetClick(slot)}
              className={cn(
                'btn-press focus-ring flex h-9 w-full items-center justify-center rounded-md px-2 text-[11px] font-bold uppercase tracking-wide transition-colors duration-150',
                isEditing
                  ? 'bg-sky-600 text-white shadow-[0_0_0_1px_rgba(56,189,248,0.35)]'
                  : isActive
                    ? 'bg-white/[0.08] text-fg-primary'
                    : 'text-fg-muted hover:bg-white/[0.05] hover:text-fg-secondary',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              Preset {slot}
            </button>
          );
        })}
      </div>

      {expandedPreset ? <PresetInlineSettings preset={expandedPreset} /> : null}
    </div>
  );
}
