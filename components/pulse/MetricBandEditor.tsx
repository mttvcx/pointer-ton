'use client';

import { RotateCcw } from 'lucide-react';
import type { MetricBand, MetricBandColors } from '@/lib/preferences/pulseDisplay';
import { metricBandTierRangeLabel } from '@/lib/pulse/metricBandColor';

type TierKey = 'low' | 'mid' | 'high';

const TIERS: { key: TierKey; field: 'low' | 'mid' | null; colorIndex: 0 | 1 | 2 }[] = [
  { key: 'low', field: 'low', colorIndex: 0 },
  { key: 'mid', field: 'mid', colorIndex: 1 },
  { key: 'high', field: null, colorIndex: 2 },
];

function TierCell({
  tier,
  band,
  defaultColors,
  valueMode,
  unitSuffix,
  onBandChange,
  onColorChange,
  onResetTier,
}: {
  tier: (typeof TIERS)[number];
  band: MetricBand;
  defaultColors: MetricBandColors;
  valueMode: 'usd' | 'plain' | 'minutes';
  unitSuffix?: string;
  onBandChange: (patch: Partial<MetricBand>) => void;
  onColorChange: (index: 0 | 1 | 2, hex: string) => void;
  onResetTier: (index: 0 | 1 | 2) => void;
}) {
  const color = band.colors[tier.colorIndex];
  const rangeLabel = metricBandTierRangeLabel(tier.key, band, valueMode);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="rounded-md border border-border-subtle/90 bg-bg-sunken/70 p-1.5">
        {tier.field ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              value={band[tier.field]}
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                if (Number.isFinite(n) && n >= 0) onBandChange({ [tier.field!]: n });
              }}
              className="min-w-0 flex-1 bg-transparent px-0.5 py-0.5 font-mono text-[12px] tabular-nums text-fg-primary outline-none"
            />
            {unitSuffix ? (
              <span className="shrink-0 pr-0.5 text-[10px] font-medium text-fg-muted">{unitSuffix}</span>
            ) : null}
          </div>
        ) : (
          <div className="flex h-[1.625rem] items-center justify-center px-1 text-[11px] font-semibold text-fg-secondary">
            {band.highMode === 'above' ? 'Above' : 'Below'}
          </div>
        )}

        <div className="mt-1.5 flex items-center justify-between gap-1">
          <label className="relative block h-5 w-5 shrink-0 cursor-pointer overflow-hidden rounded-sm border border-white/10">
            <span
              className="absolute inset-0"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <input
              type="color"
              value={color}
              onChange={(e) => onColorChange(tier.colorIndex, e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label={`${rangeLabel} color`}
            />
          </label>
          <button
            type="button"
            onClick={() => onResetTier(tier.colorIndex)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-fg-muted transition hover:bg-bg-hover/60 hover:text-fg-secondary"
            title="Reset tier"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </div>
      <p className="truncate text-center text-[9px] font-medium tabular-nums text-fg-muted">{rangeLabel}</p>
    </div>
  );
}

/** Axiom-style three-tier metric threshold editor with swatches + range captions. */
export function MetricBandEditor({
  title,
  band,
  defaultColors,
  onChange,
  valueMode = 'usd',
  unitSuffix,
}: {
  title: string;
  band: MetricBand;
  defaultColors: MetricBandColors;
  onChange: (b: MetricBand) => void;
  valueMode?: 'usd' | 'plain' | 'minutes';
  unitSuffix?: string;
}) {
  function patchColors(index: 0 | 1 | 2, hex: string) {
    const colors = [...band.colors] as MetricBand['colors'];
    colors[index] = hex;
    onChange({ ...band, colors });
  }

  function resetTier(index: 0 | 1 | 2) {
    patchColors(index, defaultColors[index]);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">{title}</p>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...band,
              highMode: band.highMode === 'above' ? 'below' : 'above',
            })
          }
          className="text-[9px] font-medium uppercase tracking-wide text-fg-muted transition hover:text-fg-secondary"
          title="Toggle above/below comparison"
        >
          {band.highMode === 'above' ? 'Above mid' : 'Below mid'}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {TIERS.map((tier) => (
          <TierCell
            key={tier.key}
            tier={tier}
            band={band}
            defaultColors={defaultColors}
            valueMode={valueMode}
            unitSuffix={unitSuffix}
            onBandChange={(patch) => onChange({ ...band, ...patch })}
            onColorChange={patchColors}
            onResetTier={resetTier}
          />
        ))}
      </div>
    </div>
  );
}
