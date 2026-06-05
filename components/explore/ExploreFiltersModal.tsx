'use client';

import { GlassModal } from '@/components/ui/GlassModal';
import { modalBtnPrimaryClass, modalBtnSecondaryClass } from '@/lib/ui/modalChrome';
import type { ExploreFilterState } from '@/types/explore';
import { EMPTY_EXPLORE_FILTERS } from '@/types/explore';
import { useEffect, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  value: ExploreFilterState;
  onApply: (v: ExploreFilterState) => void;
};

export function ExploreFiltersModal({ open, onClose, value, onApply }: Props) {
  const [local, setLocal] = useState(value);
  /* eslint-disable react-hooks/set-state-in-effect -- reset draft filters when modal opens */
  useEffect(() => {
    if (open) setLocal(value);
  }, [open, value]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title="Filters"
      description="Tune the cohort before it hits the bubble field or table."
      maxWidthClass="max-w-md"
      zClass="z-[530]"
      footer={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setLocal({ ...EMPTY_EXPLORE_FILTERS });
              onApply({ ...EMPTY_EXPLORE_FILTERS });
              onClose();
            }}
            className={modalBtnSecondaryClass}
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(local);
              onClose();
            }}
            className={modalBtnPrimaryClass}
          >
            Apply filters
          </button>
        </div>
      }
    >
      <div className="space-y-3 pb-1">
        <NumField label="Min mcap (USD)" v={local.minMcapUsd} onChange={(n) => setLocal((s) => ({ ...s, minMcapUsd: n }))} />
        <NumField label="Max mcap (USD)" v={local.maxMcapUsd} onChange={(n) => setLocal((s) => ({ ...s, maxMcapUsd: n }))} />
        <NumField
          label="Min liquidity (USD)"
          v={local.minLiquidityUsd}
          onChange={(n) => setLocal((s) => ({ ...s, minLiquidityUsd: n }))}
        />
        <NumField
          label="Min volume window (USD)"
          v={local.minVolumeUsd}
          onChange={(n) => setLocal((s) => ({ ...s, minVolumeUsd: n }))}
        />
        <NumField
          label="Min mindshare score"
          v={local.minMindshare}
          onChange={(n) => setLocal((s) => ({ ...s, minMindshare: n }))}
          step={0.5}
        />
        <NumField
          label="Min wallet signal (indexed)"
          v={local.minWalletSignal}
          onChange={(n) => setLocal((s) => ({ ...s, minWalletSignal: n }))}
          hint="Will filter out tokens until tracked-wallet feeds land."
        />
        <NumField
          label="Max risk score"
          v={local.maxRisk}
          onChange={(n) => setLocal((s) => ({ ...s, maxRisk: n }))}
        />

        <label className="flex items-center gap-2 text-[12px] text-fg-primary">
          <input
            type="checkbox"
            checked={local.excludeHighRisk}
            onChange={(e) => setLocal((s) => ({ ...s, excludeHighRisk: e.target.checked }))}
          />{' '}
          Exclude elevated risk (&ge;72)
        </label>

        <label className="flex items-center gap-2 text-[12px] text-fg-primary">
          <input
            type="checkbox"
            checked={local.onlySocialSignals}
            onChange={(e) => setLocal((s) => ({ ...s, onlySocialSignals: e.target.checked }))}
          />{' '}
          Requires linked social / web cues
        </label>

        <NumField
          label="Only new pairs (hours max)"
          v={local.onlyNewPairsHours}
          onChange={(n) => setLocal((s) => ({ ...s, onlyNewPairsHours: n }))}
          hint="Leave blank to ignore pair age filtering."
        />
      </div>
    </GlassModal>
  );
}

function NumField({
  label,
  v,
  onChange,
  step,
  hint,
}: {
  label: string;
  v: number | null;
  onChange: (n: number | null) => void;
  step?: number;
  hint?: string;
}) {
  const str = v == null ? '' : String(v);
  return (
    <label className="block text-[11px]">
      <div className="mb-1 flex justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
        <span>{label}</span>
        {hint ? <span className="max-w-[55%] text-right normal-case">{hint}</span> : null}
      </div>
      <input
        type="number"
        placeholder="Any"
        value={str}
        step={step ?? 1000}
        onChange={(e) => {
          const t = e.target.value.trim();
          if (!t) onChange(null);
          else {
            const n = Number(t);
            onChange(Number.isFinite(n) ? n : null);
          }
        }}
        className="w-full rounded-lg border border-white/14 bg-black/35 px-2.5 py-2 text-[12px] text-fg-primary"
      />
    </label>
  );
}
