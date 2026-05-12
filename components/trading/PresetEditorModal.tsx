'use client';

import { useState } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import type { MevMode } from '@/lib/trading/mevMode';
import { cn } from '@/lib/utils/cn';
import type { PresetSlot } from '@/store/trading';
import { useUIStore } from '@/store/ui';
import { nativeTicker } from '@/lib/chains/nativeCurrency';

type FullPreset = {
  slot: PresetSlot;
  name: string;
  buy_amounts_sol: number[];
  slippage_bps: number;
  dynamic_slippage: boolean;
  mev_mode: MevMode;
};

type Props = {
  open: boolean;
  onClose: () => void;
  preset: FullPreset | null;
};

function PresetEditorForm({
  preset,
  onClose,
}: {
  preset: FullPreset;
  onClose: () => void;
}) {
  const { getAccessToken } = usePointerAuth();
  const qc = useQueryClient();
  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);
  const [name, setName] = useState(preset.name);
  const [amountsStr, setAmountsStr] = useState(preset.buy_amounts_sol.join(','));
  const [slippageBps, setSlippageBps] = useState(preset.slippage_bps);
  const [dynamicSlippage, setDynamicSlippage] = useState(preset.dynamic_slippage);
  const [mevMode, setMevMode] = useState<MevMode>(preset.mev_mode);

  const save = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const parts = amountsStr
        .split(/[\s,]+/)
        .map((s) => Number.parseFloat(s))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (parts.length < 1) throw new Error('amounts');
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slot: preset.slot,
          name: name.trim() || preset.name,
          buy_amounts_sol: parts.slice(0, 8),
          slippage_bps: Math.min(5000, Math.max(1, Math.round(slippageBps))),
          dynamic_slippage: dynamicSlippage,
          mev_mode: mevMode,
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
      toast.success('Preset saved');
      onClose();
    },
    onError: (e) => {
      toast.error('Could not save preset', {
        description: e instanceof Error ? e.message.slice(0, 120) : undefined,
      });
    },
  });

  return (
    <div className="fixed inset-0 z-[560] flex animate-in fade-in items-center justify-center bg-black/70 p-4 duration-200">
      <div
        className="flex max-h-[90vh] w-full max-w-md animate-in zoom-in-95 fade-in flex-col overflow-y-auto rounded-lg border border-border-subtle bg-bg-base shadow-lg duration-200"
        role="dialog"
        aria-labelledby="preset-editor-title"
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 id="preset-editor-title" className="text-sm font-semibold text-fg-primary">
            Edit {preset.name}
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
          <label className="block space-y-1">
            <span className="font-semibold uppercase tracking-wide text-fg-muted">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="focus-ring w-full border border-border-subtle bg-transparent px-2 py-1.5 text-fg-primary"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-semibold uppercase tracking-wide text-fg-muted">
              Buy chips ({nativeSym})
            </span>
            <input
              value={amountsStr}
              onChange={(e) => setAmountsStr(e.target.value)}
              placeholder="0.1,0.5,1,5"
              className="focus-ring w-full border border-border-subtle bg-transparent px-2 py-1.5 tabular-nums text-fg-primary"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-semibold uppercase tracking-wide text-fg-muted">
              Slippage (bps)
            </span>
            <input
              type="number"
              min={1}
              max={5000}
              value={slippageBps}
              onChange={(e) => setSlippageBps(Number(e.target.value))}
              className="focus-ring w-full border border-border-subtle bg-transparent px-2 py-1.5 tabular-nums text-fg-primary"
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={dynamicSlippage}
              onChange={(e) => setDynamicSlippage(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border-subtle"
            />
            <span className="text-fg-secondary">Dynamic slippage</span>
          </label>
          <div className="space-y-1">
            <span className="font-semibold uppercase tracking-wide text-fg-muted">MEV</span>
            <div className="flex gap-1">
              {(['off', 'reduced', 'secure'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMevMode(m)}
                  className={cn(
                    'btn-press flex-1 rounded-full border py-1 text-[10px] font-semibold capitalize',
                    mevMode === m
                      ? 'border-accent-primary/50 text-accent-primary'
                      : 'border-border-subtle text-fg-muted hover:border-border-default',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-[10px] leading-snug text-fg-muted">
              Reduced routes via Jito; Off / Secure use RPC-style landing in the swap builder.
            </p>
          </div>
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

export function PresetEditorModal({ open, onClose, preset }: Props) {
  if (!open || !preset) return null;
  return <PresetEditorForm key={preset.slot} preset={preset} onClose={onClose} />;
}
