'use client';

import { useEffect, useState } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import type { PresetSlot } from '@/store/trading';

export type AdvancedTradingPreset = {
  slot: PresetSlot;
  name: string;
  priority_fee_lamports: number;
  jito_tip_lamports: number;
  auto_fee: boolean;
  max_fee_sol: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  preset: AdvancedTradingPreset | null;
};

function FormBody({
  preset,
  onClose,
}: {
  preset: AdvancedTradingPreset;
  onClose: () => void;
}) {
  const { getAccessToken } = usePointerAuth();
  const qc = useQueryClient();
  const [priorityLamports, setPriorityLamports] = useState(preset.priority_fee_lamports);
  const [jitoTip, setJitoTip] = useState(preset.jito_tip_lamports);
  const [autoFee, setAutoFee] = useState(preset.auto_fee);
  const [maxFeeSol, setMaxFeeSol] = useState(preset.max_fee_sol);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setPriorityLamports(preset.priority_fee_lamports);
      setJitoTip(preset.jito_tip_lamports);
      setAutoFee(preset.auto_fee);
      setMaxFeeSol(preset.max_fee_sol);
    });
    return () => cancelAnimationFrame(raf);
  }, [
    preset.slot,
    preset.priority_fee_lamports,
    preset.jito_tip_lamports,
    preset.auto_fee,
    preset.max_fee_sol,
  ]);

  const save = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const maxSol = Number(maxFeeSol);
      if (!Number.isFinite(maxSol) || maxSol < 0.000001 || maxSol > 5) {
        throw new Error('max_fee_sol');
      }
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slot: preset.slot,
          priority_fee_lamports: Math.min(5_000_000, Math.max(0, Math.round(priorityLamports))),
          jito_tip_lamports: Math.min(5_000_000, Math.max(0, Math.round(jitoTip))),
          auto_fee: autoFee,
          max_fee_sol: maxSol,
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
      toast.success('Advanced settings saved');
      onClose();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'max_fee_sol') {
        toast.error('Invalid max fee', { description: 'Use a value between 0.000001 and 5 TON.' });
        return;
      }
      toast.error('Could not save', {
        description: e instanceof Error ? e.message.slice(0, 120) : undefined,
      });
    },
  });

  return (
    <div className="fixed inset-0 z-[560] flex animate-in fade-in items-center justify-center bg-black/70 p-4 duration-200">
      <div
        className="flex max-h-[90vh] w-full max-w-md animate-in zoom-in-95 fade-in flex-col overflow-y-auto rounded-lg border border-border-subtle bg-bg-base shadow-lg duration-200"
        role="dialog"
        aria-labelledby="advanced-trading-title"
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 id="advanced-trading-title" className="text-sm font-semibold text-fg-primary">
            Advanced: {preset.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-press rounded p-1 text-fg-muted hover:text-fg-primary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-3 text-xs">
          <p className="text-[10px] leading-snug text-fg-muted">
            These options apply to the active preset only. Slippage, buy chips, and MEV mode live in
            the preset editor (gear).
          </p>

          <label className="block space-y-1">
            <span className="font-semibold uppercase tracking-wide text-fg-muted">
              Jito tip (nanotons)
            </span>
            <input
              type="number"
              min={0}
              max={5_000_000}
              step={1}
              value={jitoTip}
              onChange={(e) => setJitoTip(Number(e.target.value))}
              className="focus-ring w-full border border-border-subtle bg-transparent px-2 py-1.5 tabular-nums text-fg-primary"
            />
            <span className="block text-[10px] text-fg-muted">
              Used when landing is Jito (reduced MEV). Higher tips can improve bundle inclusion under
              load.
            </span>
          </label>

          <label className="flex items-center gap-2 border-t border-border-subtle pt-2">
            <input
              type="checkbox"
              checked={autoFee}
              onChange={(e) => setAutoFee(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border-subtle"
            />
            <span className="text-fg-secondary">Auto priority fee (RPC landing)</span>
          </label>

          <label className="block space-y-1">
            <span className="font-semibold uppercase tracking-wide text-fg-muted">
              Priority fee cap / fixed (nanotons)
            </span>
            <input
              type="number"
              min={0}
              max={5_000_000}
              step={1}
              value={priorityLamports}
              onChange={(e) => setPriorityLamports(Number(e.target.value))}
              disabled={autoFee}
              className={cn(
                'focus-ring w-full border border-border-subtle bg-transparent px-2 py-1.5 tabular-nums text-fg-primary',
                autoFee && 'cursor-not-allowed opacity-50',
              )}
            />
            <span className="block text-[10px] text-fg-muted">
              {autoFee
                ? 'Disabled while auto fee is on; the router picks a level up to the max below.'
                : 'Fixed compute / priority budget on RPC-style routes (off or secure MEV).'}
            </span>
          </label>

          <label className="block space-y-1">
            <span className="font-semibold uppercase tracking-wide text-fg-muted">
              Max total fee (TON)
            </span>
            <input
              type="number"
              min={0.000001}
              max={5}
              step="any"
              value={maxFeeSol}
              onChange={(e) => setMaxFeeSol(Number(e.target.value))}
              className="focus-ring w-full border border-border-subtle bg-transparent px-2 py-1.5 tabular-nums text-fg-primary"
            />
            <span className="block text-[10px] text-fg-muted">
              Upper bound on swap-side priority spend (converted to nanotons). Current:{' '}
              {formatNumber(maxFeeSol, { decimals: 4 })} TON.
            </span>
          </label>
        </div>

        <div className="mt-auto flex justify-end gap-2 border-t border-border-subtle px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-press border border-border-subtle px-3 py-1.5 text-xs font-medium text-fg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => void save.mutate()}
            className="btn-press bg-accent-primary px-3 py-1.5 text-xs font-medium text-fg-inverse disabled:opacity-50"
          >
            {save.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdvancedTradingSettingsModal({ open, onClose, preset }: Props) {
  if (!open || !preset) return null;
  return <FormBody preset={preset} onClose={onClose} />;
}
