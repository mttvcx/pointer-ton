'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pipette, RotateCcw } from 'lucide-react';
import {
  hexToHsv,
  hexToRgb,
  hsvToHex,
  normalizeHex,
  rgbToHex,
  rgbToHsv,
} from '@/lib/ui/colorMath';
import { cn } from '@/lib/utils/cn';

type Props = {
  color: string;
  defaultColor: string;
  onChange: (hex: string) => void;
  onReset: () => void;
  className?: string;
};

function clampChannel(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Axiom-style SV square + hue rail + RGB inputs for protocol row tints. */
export function ProtocolColorPicker({ color, defaultColor, onChange, onReset, className }: Props) {
  const safeColor = normalizeHex(color);
  const [hsv, setHsv] = useState(() => hexToHsv(safeColor));
  const svRef = useRef<HTMLDivElement>(null);
  const draggingSv = useRef(false);

  useEffect(() => {
    setHsv(hexToHsv(normalizeHex(color)));
  }, [color]);

  const emitHsv = useCallback(
    (next: { h: number; s: number; v: number }) => {
      setHsv(next);
      onChange(hsvToHex(next.h, next.s, next.v));
    },
    [onChange],
  );

  const pickSv = useCallback(
    (clientX: number, clientY: number) => {
      const el = svRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const s = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
      const v = Math.max(0, Math.min(100, (1 - (clientY - r.top) / r.height) * 100));
      emitHsv({ ...hsv, s, v });
    },
    [emitHsv, hsv],
  );

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!draggingSv.current) return;
      pickSv(e.clientX, e.clientY);
    }
    function onUp() {
      draggingSv.current = false;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [pickSv]);

  const { r, g, b } = hexToRgb(safeColor);

  function setRgbChannel(channel: 'r' | 'g' | 'b', value: number) {
    const next = { r, g, b, [channel]: clampChannel(value) };
    emitHsv(rgbToHsv(next.r, next.g, next.b));
  }

  return (
    <div className={cn('space-y-2.5 rounded-lg border border-border-subtle bg-bg-sunken/50 p-2.5', className)}>
      <div
        ref={svRef}
        className="relative h-28 w-full cursor-crosshair overflow-hidden rounded-md"
        style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
        onPointerDown={(e) => {
          draggingSv.current = true;
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          pickSv(e.clientX, e.clientY);
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black to-transparent" />
        <span
          className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
          style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }}
          aria-hidden
        />
      </div>

      <div className="flex items-center gap-2">
        <label
          className="relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10"
          title="Pick color"
        >
          <span className="absolute inset-0.5 rounded-full" style={{ backgroundColor: safeColor }} aria-hidden />
          <Pipette className="relative z-[1] h-3 w-3 text-white/80" strokeWidth={2.25} aria-hidden />
          <input
            type="color"
            value={safeColor}
            onChange={(e) => onChange(normalizeHex(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Eyedropper"
          />
        </label>

        <input
          type="range"
          min={0}
          max={360}
          step={1}
          value={Math.round(hsv.h)}
          onChange={(e) => emitHsv({ ...hsv, h: Number(e.target.value) })}
          className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-fg-primary"
          style={{
            background:
              'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
          }}
          aria-label="Hue"
        />

        <button
          type="button"
          onClick={onReset}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-subtle text-fg-muted transition hover:bg-bg-hover/60 hover:text-fg-secondary"
          title={`Reset to ${defaultColor}`}
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {(['r', 'g', 'b'] as const).map((ch) => (
          <label key={ch} className="flex flex-col gap-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-fg-muted">{ch}</span>
            <input
              type="number"
              min={0}
              max={255}
              value={ch === 'r' ? r : ch === 'g' ? g : b}
              onChange={(e) => setRgbChannel(ch, Number(e.target.value))}
              className="w-full rounded-md border border-border-subtle bg-bg-base px-2 py-1 font-mono text-[11px] tabular-nums text-fg-primary outline-none focus:ring-1 focus:ring-accent-primary/35"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
