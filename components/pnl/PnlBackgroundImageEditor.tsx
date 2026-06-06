'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CloudUpload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PnlTrackerSceneChrome } from '@/components/pnl/PnlTrackerSceneChrome';
import { PointerBirdMark } from '@/components/branding/PointerBirdMark';
import { presetClass } from '@/lib/share/backgrounds';
import type { ShareBackgroundPresetId } from '@/lib/share/types';
import {
  backgroundImageStyle,
  clampBackgroundScale,
  DEFAULT_PNL_BACKGROUND_TRANSFORM,
  PNL_TRACKER_BG_ASPECT,
  PNL_TRACKER_BG_MAX_BYTES,
  type PnlBackgroundTransform,
} from '@/lib/pnl/backgroundTransform';
import { cn } from '@/lib/utils/cn';

type HandleId = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLES: Exclude<HandleId, 'move'>[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const HANDLE_POS: Record<Exclude<HandleId, 'move'>, string> = {
  nw: '-left-1 -top-1 cursor-nwse-resize',
  n: 'left-1/2 -top-1 -translate-x-1/2 cursor-ns-resize',
  ne: '-right-1 -top-1 cursor-nesw-resize',
  e: '-right-1 top-1/2 -translate-y-1/2 cursor-ew-resize',
  se: '-right-1 -bottom-1 cursor-nwse-resize',
  s: 'bottom-[-4px] left-1/2 -translate-x-1/2 cursor-ns-resize',
  sw: '-bottom-1 -left-1 cursor-nesw-resize',
  w: '-left-1 top-1/2 -translate-y-1/2 cursor-ew-resize',
};

function scaleDeltaForHandle(handle: Exclude<HandleId, 'move'>, dx: number, dy: number, w: number, h: number) {
  const normX = dx / w;
  const normY = dy / h;
  switch (handle) {
    case 'se':
      return (normX + normY) * 1.4;
    case 'nw':
      return (-normX - normY) * 1.4;
    case 'ne':
      return (normX - normY) * 1.4;
    case 'sw':
      return (-normX + normY) * 1.4;
    case 'e':
      return normX * 1.6;
    case 'w':
      return -normX * 1.6;
    case 's':
      return normY * 1.6;
    case 'n':
      return -normY * 1.6;
    default:
      return 0;
  }
}

export function PnlBackgroundImageEditor({
  presetId,
  customUrl,
  transform,
  onTransformChange,
  onPickFile,
  onClearCustom,
}: {
  presetId: ShareBackgroundPresetId;
  customUrl: string | null;
  transform: PnlBackgroundTransform;
  onTransformChange: (t: PnlBackgroundTransform) => void;
  onPickFile: (file: File) => void | Promise<void>;
  onClearCustom: () => void | Promise<void>;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{
    handle: HandleId;
    pid: number;
    sx: number;
    sy: number;
    start: PnlBackgroundTransform;
    w: number;
    h: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
  }, []);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pid) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (d.handle === 'move') {
        onTransformChange({
          ...d.start,
          offsetX: d.start.offsetX + (dx / d.w) * 100,
          offsetY: d.start.offsetY + (dy / d.h) * 100,
        });
        return;
      }
      const delta = scaleDeltaForHandle(d.handle, dx, dy, d.w, d.h);
      onTransformChange({
        ...d.start,
        scale: clampBackgroundScale(d.start.scale + delta),
      });
    }
    function onUp(e: PointerEvent) {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pid) return;
      endDrag();
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [endDrag, onTransformChange]);

  const startDrag = (e: React.PointerEvent, handle: HandleId) => {
    if (!customUrl) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      handle,
      pid: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      start: { ...transform },
      w: rect.width,
      h: rect.height,
    };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > PNL_TRACKER_BG_MAX_BYTES) {
      toast.error(`Image too large (max ${Math.round(PNL_TRACKER_BG_MAX_BYTES / 1024)}KB)`);
      return;
    }
    void onPickFile(file);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-fg-secondary">Background Image</span>
        {customUrl ? (
          <button
            type="button"
            title="Remove custom background"
            aria-label="Remove custom background"
            onClick={() => void onClearCustom()}
            className="rounded-sm p-1 text-signal-bear/90 hover:bg-signal-bear/10 hover:text-signal-bear"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        ) : null}
      </div>

      <div
        ref={frameRef}
        className="group/preview relative overflow-hidden rounded-sm border border-white/[0.08] bg-black/40"
        style={{ aspectRatio: `${PNL_TRACKER_BG_ASPECT} / 1` }}
      >
        <div className={cn('absolute inset-0', !customUrl && presetClass(presetId))} aria-hidden />
        {customUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={customUrl}
            alt=""
            draggable={false}
            className={cn(
              'absolute inset-0 h-full w-full object-cover select-none',
              customUrl && !dragging && 'cursor-grab',
              dragging && 'cursor-grabbing',
            )}
            style={backgroundImageStyle(transform)}
            onPointerDown={(e) => startDrag(e, 'move')}
          />
        ) : null}

        <PnlTrackerSceneChrome
          backgroundId={presetId}
          hasCustomMedia={Boolean(customUrl)}
          compact
        />

        {/* Live widget mock — balance / PNL row */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex items-end justify-between px-3 pb-2 pt-6">
          <div>
            <p className="text-[15px] font-semibold tabular-nums leading-none text-white">$249.9</p>
            <p className="mt-0.5 text-[8px] font-medium uppercase tracking-wide text-white/45">Balance</p>
          </div>
          <div className="flex flex-col items-center pb-0.5">
            <PointerBirdMark className="h-6 w-6" size={24} />
            <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-white/80">pointer</p>
          </div>
          <div className="text-right">
            <p className="text-[15px] font-semibold tabular-nums leading-none text-signal-bear">-$24.99</p>
            <p className="mt-0.5 text-[8px] font-medium uppercase tracking-wide text-white/45">PNL</p>
          </div>
        </div>

        {customUrl
          ? HANDLES.map((h) => (
              <span
                key={h}
                role="presentation"
                onPointerDown={(e) => startDrag(e, h)}
                className={cn(
                  'absolute z-30 h-2 w-2 rounded-[2px] border border-white/80 bg-accent-primary/90 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]',
                  HANDLE_POS[h],
                  dragging && 'opacity-100',
                  !dragging && 'opacity-0 transition-opacity group-hover/preview:opacity-100',
                )}
              />
            ))
          : null}

        {/* Hover upload affordance — visual overlay on hover; only the button captures clicks */}
        <div
          className={cn(
            'absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 pointer-events-none',
            'bg-black/55 text-white transition-opacity',
            dragging ? 'opacity-0' : 'opacity-0 group-hover/preview:opacity-100',
            !customUrl && 'opacity-100',
          )}
        >
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="pointer-events-auto flex flex-col items-center justify-center gap-1.5 rounded-md px-4 py-3 hover:bg-white/[0.06]"
          >
            <CloudUpload className="h-6 w-6 text-white/90" strokeWidth={1.75} />
            <span className="text-[11px] font-medium text-white/90">Upload custom background</span>
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      <p className="mt-1.5 text-[10px] text-fg-muted">
        Recommended aspect ratio {PNL_TRACKER_BG_ASPECT}:1 and {(PNL_TRACKER_BG_MAX_BYTES / 1024).toFixed(0)}KB file
        size
        {customUrl ? (
          <>
            {' '}
            · drag image to move · drag handles to resize
          </>
        ) : null}
      </p>
    </div>
  );
}

export { DEFAULT_PNL_BACKGROUND_TRANSFORM };
