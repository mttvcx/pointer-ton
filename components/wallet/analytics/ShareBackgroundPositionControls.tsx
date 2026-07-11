'use client';

import { modalSectionLabelClass } from '@/lib/ui/modalChrome';

export function ShareBackgroundPositionControls({
  zoom,
  onZoom,
  onReset,
}: {
  zoom: number;
  onZoom: (zoom: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#191919]/80 p-4 shadow-2xl backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-2">
        <p className={modalSectionLabelClass}>Background</p>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] font-medium text-fg-secondary hover:text-fg-primary"
        >
          Reset
        </button>
      </div>
      <p className="mt-1 text-[11px] text-fg-muted">Drag the preview to reposition · zoom below.</p>
      <div className="mt-3">
        <FrameSlider
          label="Zoom"
          value={zoom}
          min={1}
          max={2.5}
          step={0.02}
          onChange={onZoom}
          display={`${zoom.toFixed(2)}×`}
        />
      </div>
    </div>
  );
}

function FrameSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  display?: string;
}) {
  return (
    <label className="min-w-0 text-[10.5px] text-fg-muted">
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-fg-secondary">{display ?? value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-white"
      />
    </label>
  );
}
