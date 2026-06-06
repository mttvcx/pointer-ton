'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pipette, RotateCcw } from 'lucide-react';
import {
  DEFAULT_PULSE_ACCENT_HEX,
} from '@/lib/ui/pulseAccent';
import {
  hexToHsv,
  hsvToHex,
  normalizeHex,
} from '@/lib/ui/colorMath';
import { cn } from '@/lib/utils/cn';

type Props = {
  color: string;
  onChange: (hex: string) => void;
  className?: string;
};

/** Compact hue + swatch row for quick-buy / ultra outline accent (Display panel). */
export function PulseAccentColorPicker({ color, onChange, className }: Props) {
  const safeColor = normalizeHex(color);
  const [hsv, setHsv] = useState(() => hexToHsv(safeColor));
  const [expanded, setExpanded] = useState(false);
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

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-bg-sunken/50 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 shrink text-left text-[11px] font-medium text-fg-secondary"
          aria-expanded={expanded}
        >
          Quick buy color
        </button>

        <label
          className="relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border-subtle"
          title="Pick color"
        >
          <span
            className="absolute inset-0.5 rounded-full"
            style={{ backgroundColor: safeColor }}
            aria-hidden
          />
          <Pipette className="relative z-[1] h-2.5 w-2.5 text-fg-muted" strokeWidth={2.25} aria-hidden />
          <input
            type="color"
            value={safeColor}
            onChange={(e) => onChange(normalizeHex(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Pick quick buy color"
          />
        </label>

        <input
          type="range"
          min={0}
          max={360}
          step={1}
          value={Math.round(hsv.h)}
          onChange={(e) => emitHsv({ ...hsv, h: Number(e.target.value) })}
          className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-fg-primary"
          style={{
            background:
              'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
          }}
          aria-label="Hue"
        />

        <button
          type="button"
          onClick={() => onChange(DEFAULT_PULSE_ACCENT_HEX)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-fg-muted transition hover:bg-bg-hover/60 hover:text-fg-secondary"
          title="Reset to default green"
        >
          <RotateCcw className="h-3 w-3" strokeWidth={2.25} aria-hidden />
        </button>
      </div>

      {expanded ? (
        <div
          ref={svRef}
          className="relative h-20 w-full cursor-crosshair overflow-hidden rounded-md border border-border-subtle"
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
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
            style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }}
            aria-hidden
          />
        </div>
      ) : null}
    </div>
  );
}
