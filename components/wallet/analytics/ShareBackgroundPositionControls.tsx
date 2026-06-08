'use client';

import { modalSectionLabelClass } from '@/lib/ui/modalChrome';

export function ShareBackgroundPositionControls({
  pan,
  zoom,
  onPan,
  onZoom,
  onReset,
}: {
  pan: { x: number; y: number };
  zoom: number;
  onPan: (pan: { x: number; y: number }) => void;
  onZoom: (zoom: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-sunken p-3">
      <div className="flex items-center justify-between gap-2">
        <p className={modalSectionLabelClass}>Background position</p>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] font-medium text-fg-secondary hover:text-fg-primary"
        >
          Reset
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <FrameSlider
          label="X"
          value={pan.x}
          min={-50}
          max={50}
          step={1}
          onChange={(x) => onPan({ ...pan, x })}
        />
        <FrameSlider
          label="Y"
          value={pan.y}
          min={-50}
          max={50}
          step={1}
          onChange={(y) => onPan({ ...pan, y })}
        />
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
        className="mt-1.5 w-full accent-accent-primary"
      />
    </label>
  );
}
