'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  RefreshCw,
  Settings,
  X,
} from 'lucide-react';
import { usePnlTrackerData } from '@/lib/hooks/usePnlTrackerData';
import { formatPnlTerminal, formatSolTerminal } from '@/lib/pnl/formatSolDisplay';
import { readLayoutChromePx } from '@/lib/layout/dockPeekSnap';
import { presetClass } from '@/lib/share/backgrounds';
import { backgroundImageStyle } from '@/lib/pnl/backgroundTransform';
import { PnlTrackerSceneChrome } from '@/components/pnl/PnlTrackerSceneChrome';
import { PointerBirdMark } from '@/components/branding/PointerBirdMark';
import { spotTickerIconSrc } from '@/lib/chains/chainAssets';
import { cn } from '@/lib/utils/cn';
import { formatCompactUsd } from '@/lib/utils/formatters';
import {
  clampPnlTrackerPosition,
  clampPnlTrackerSize,
  defaultPnlTrackerPosition,
  DEFAULT_PNL_TRACKER_SIZE,
  usePnlTrackerStore,
} from '@/store/pnlTracker';
import { PnlTrackerSettingsModal } from '@/components/pnl/PnlTrackerSettingsModal';

type ResizeHandle = 'se' | 'e' | 's';

type DragPhase = { pid: number; ox: number; oy: number; sx: number; sy: number };
type ResizePhase = {
  pid: number;
  handle: ResizeHandle;
  ow: number;
  oh: number;
  sx: number;
  sy: number;
};

export function PnlTrackerFloatingWidget() {
  const open = usePnlTrackerStore((s) => s.open);
  const settingsOpen = usePnlTrackerStore((s) => s.settingsOpen);
  const position = usePnlTrackerStore((s) => s.position);
  const size = usePnlTrackerStore((s) => s.size ?? DEFAULT_PNL_TRACKER_SIZE);
  const prefs = usePnlTrackerStore((s) => s.prefs);
  const setOpen = usePnlTrackerStore((s) => s.setOpen);
  const setSettingsOpen = usePnlTrackerStore((s) => s.setSettingsOpen);
  const setPosition = usePnlTrackerStore((s) => s.setPosition);
  const setSize = usePnlTrackerStore((s) => s.setSize);
  const customBackgroundObjectUrl = usePnlTrackerStore((s) => s.customBackgroundObjectUrl);
  const hydrateCustomBackground = usePnlTrackerStore((s) => s.hydrateCustomBackground);

  const { solBalance, totalPnlUsd, totalPnlSol, solUsd, isLoading, isFetching, refetch, activeChain, portfolioScope } =
    usePnlTrackerData();

  const shellRef = useRef<HTMLDivElement | null>(null);
  const dragPhase = useRef<DragPhase | null>(null);
  const resizePhase = useRef<ResizePhase | null>(null);
  const [draggingUi, setDraggingUi] = useState(false);
  const [resizingUi, setResizingUi] = useState(false);
  const [hovered, setHovered] = useState(false);
  const seededPos = useRef(false);

  const widgetW = size.width;
  const widgetH = size.height;
  const scale = widgetH / DEFAULT_PNL_TRACKER_SIZE.height;
  const valueFontPx = Math.max(16, Math.round(22 * scale));
  const labelFontPx = Math.max(8, Math.round(10 * scale));
  const logoH = Math.max(20, Math.round(28 * scale));
  const brandFontPx = Math.max(8, Math.round(9 * scale));

  useLayoutEffect(() => {
    void hydrateCustomBackground();
  }, [hydrateCustomBackground]);

  useLayoutEffect(() => {
    if (seededPos.current || !open) return;
    if (position.x !== 0 || position.y !== 0) {
      seededPos.current = true;
      return;
    }
    const { topbar } = readLayoutChromePx();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    setPosition(defaultPnlTrackerPosition(vw, topbar, size));
    seededPos.current = true;
  }, [open, position.x, position.y, setPosition, size]);

  const clampPos = useCallback(
    (x: number, y: number) => clampPnlTrackerPosition(x, y, { width: widgetW, height: widgetH }),
    [widgetW, widgetH],
  );

  const onDragPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (settingsOpen) return;
    if ((e.target as HTMLElement).closest('[data-pnl-no-drag]')) return;
    setDraggingUi(true);
    dragPhase.current = {
      pid: e.pointerId,
      ox: position.x,
      oy: position.y,
      sx: e.clientX,
      sy: e.clientY,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onResizePointerDown = (e: React.PointerEvent, handle: ResizeHandle) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setResizingUi(true);
    resizePhase.current = {
      pid: e.pointerId,
      handle,
      ow: widgetW,
      oh: widgetH,
      sx: e.clientX,
      sy: e.clientY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const rz = resizePhase.current;
      if (rz && e.pointerId === rz.pid) {
        const dx = e.clientX - rz.sx;
        const dy = e.clientY - rz.sy;
        let nextW = rz.ow;
        let nextH = rz.oh;
        if (rz.handle === 'se' || rz.handle === 'e') nextW = rz.ow + dx;
        if (rz.handle === 'se' || rz.handle === 's') nextH = rz.oh + dy;
        setSize(clampPnlTrackerSize(nextW, nextH));
        return;
      }

      const d = dragPhase.current;
      if (!d || e.pointerId !== d.pid) return;
      setPosition(clampPos(d.ox + (e.clientX - d.sx), d.oy + (e.clientY - d.sy)));
    }

    function onUp(e: PointerEvent) {
      const d = dragPhase.current;
      const rz = resizePhase.current;
      if (d && e.pointerId === d.pid) {
        dragPhase.current = null;
        setDraggingUi(false);
      }
      if (rz && e.pointerId === rz.pid) {
        resizePhase.current = null;
        setResizingUi(false);
      }
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [clampPos, setPosition, setSize]);

  useEffect(() => {
    function onResize() {
      const p = usePnlTrackerStore.getState().position;
      setPosition(clampPnlTrackerPosition(p.x, p.y, { width: widgetW, height: widgetH }));
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setPosition, widgetW, widgetH]);

  if (activeChain !== 'sol') return null;

  const pnlPositive = totalPnlUsd >= 0;
  const balancePrimary = prefs.swapUsdAndSol
    ? solUsd != null
      ? formatCompactUsd(solBalance * solUsd)
      : '—'
    : formatSolTerminal(solBalance);
  const pnlPrimary = prefs.swapUsdAndSol
    ? formatPnlTerminal(totalPnlSol, 'sol')
    : formatPnlTerminal(totalPnlUsd, 'usd');
  const balanceShowsSol = !prefs.swapUsdAndSol;
  const pnlShowsSol = prefs.swapUsdAndSol;
  const balanceLabel = prefs.swapUsdAndSol ? 'Balance (USD)' : 'Balance';
  const pnlLabel = prefs.swapUsdAndSol ? 'PNL (SOL)' : 'PNL';
  const solIcon = spotTickerIconSrc('SOL');
  const solIconPx = Math.max(14, Math.round(16 * scale));
  const chromeVisible = hovered || settingsOpen || draggingUi || resizingUi;

  return (
    <>
      {open ? (
      <div
        ref={shellRef}
        role="complementary"
        aria-label="PnL tracker"
        className={cn(
          'fixed z-[150] select-none overflow-hidden rounded-md border border-white/[0.1] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)] transition-opacity duration-150',
          draggingUi ? 'cursor-grabbing opacity-90' : resizingUi ? 'opacity-95' : 'cursor-grab',
        )}
        style={{
          left: position.x,
          top: position.y,
          width: widgetW,
          height: widgetH,
          opacity: prefs.opacityPct / 100,
        }}
        onPointerDown={onDragPointerDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className={cn('absolute inset-0', !customBackgroundObjectUrl && presetClass(prefs.backgroundId))}
          style={{ filter: prefs.blurPx > 0 ? `blur(${prefs.blurPx}px)` : undefined }}
          aria-hidden
        />
        {customBackgroundObjectUrl ? (
          <div className="absolute inset-0 overflow-hidden" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={customBackgroundObjectUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                ...backgroundImageStyle(prefs.backgroundTransform),
                filter: prefs.blurPx > 0 ? `blur(${prefs.blurPx}px)` : undefined,
              }}
              referrerPolicy="no-referrer"
            />
          </div>
        ) : null}

        <PnlTrackerSceneChrome
          backgroundId={prefs.backgroundId}
          hasCustomMedia={Boolean(customBackgroundObjectUrl)}
          compact
          className="z-[1]"
        />

        <div
          className={cn(
            'absolute inset-x-0 top-0 z-[4] flex items-center justify-between px-2 py-1 transition-opacity',
            chromeVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <div className="flex items-center gap-0.5" data-pnl-no-drag>
            <button
              type="button"
              title="Settings"
              aria-label="PnL settings"
              onClick={() => setSettingsOpen(true)}
              className="rounded-sm p-1 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Settings className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
            <Link
              href="/portfolio"
              data-pnl-no-drag
              title="Open portfolio"
              className="rounded-sm p-1 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <BarChart3 className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>
          <div className="flex items-center gap-0.5" data-pnl-no-drag>
            <button
              type="button"
              title="Refresh"
              aria-label="Refresh PnL"
              onClick={() => void refetch()}
              className="rounded-sm p-1 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', (isFetching || isLoading) && 'animate-spin')}
                strokeWidth={2}
              />
            </button>
            <button
              type="button"
              title="Close"
              aria-label="Close PnL tracker"
              onClick={() => setOpen(false)}
              className="rounded-sm p-1 text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Resize handles — hover or active resize */}
        <div
          className={cn(
            'pointer-events-none absolute inset-0 z-[5] transition-opacity',
            chromeVisible ? 'opacity-100' : 'opacity-0',
          )}
          aria-hidden
        >
          <button
            type="button"
            data-pnl-no-drag
            title="Resize width"
            aria-label="Resize width"
            onPointerDown={(e) => onResizePointerDown(e, 'e')}
            className={cn(
              'pointer-events-auto absolute top-[22%] bottom-[14%] right-0 w-2 cursor-ew-resize',
              resizingUi ? 'bg-white/10' : 'hover:bg-white/[0.08]',
            )}
          />
          <button
            type="button"
            data-pnl-no-drag
            title="Resize height"
            aria-label="Resize height"
            onPointerDown={(e) => onResizePointerDown(e, 's')}
            className={cn(
              'pointer-events-auto absolute inset-x-3 bottom-0 h-2 cursor-ns-resize',
              resizingUi ? 'bg-white/10' : 'hover:bg-white/[0.08]',
            )}
          />
          <button
            type="button"
            data-pnl-no-drag
            title="Resize"
            aria-label="Resize"
            onPointerDown={(e) => onResizePointerDown(e, 'se')}
            className={cn(
              'pointer-events-auto absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize rounded-tl-sm',
              resizingUi ? 'bg-white/15' : 'hover:bg-white/10',
            )}
          />
        </div>

        <div
          className="relative z-[2] flex h-full flex-col justify-end px-3 pb-2 pt-6"
          style={{ paddingBottom: Math.max(8, Math.round(8 * scale)) }}
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span
                  className="truncate font-semibold tabular-nums leading-none text-white"
                  style={{ fontSize: valueFontPx }}
                >
                  {isLoading ? '…' : balancePrimary}
                </span>
                {balanceShowsSol && solIcon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={solIcon}
                    alt=""
                    className="shrink-0 object-contain"
                    style={{ width: solIconPx, height: solIconPx }}
                  />
                ) : null}
              </div>
              <span
                className="mt-1 block font-medium uppercase tracking-wide text-white/45"
                style={{ fontSize: labelFontPx }}
              >
                {balanceLabel}
              </span>
            </div>

            <div className="flex flex-col items-center pb-0.5">
              <div className="shrink-0" style={{ width: logoH, height: logoH }}>
                <PointerBirdMark size={logoH} className="h-full w-full" />
              </div>
              <span
                className="mt-0.5 font-bold uppercase tracking-[0.18em] text-white/80"
                style={{ fontSize: brandFontPx }}
              >
                pointer
              </span>
              {portfolioScope ? (
                <span
                  className="mt-0.5 max-w-[5.5rem] truncate font-medium text-white/45"
                  style={{ fontSize: Math.max(7, Math.round(8 * scale)) }}
                  title={portfolioScope.label}
                >
                  {portfolioScope.label}
                </span>
              ) : null}
            </div>

            <div className="min-w-0 text-right">
              <div className="flex items-baseline justify-end gap-1.5">
                {pnlShowsSol && solIcon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={solIcon}
                    alt=""
                    className="shrink-0 object-contain opacity-80"
                    style={{ width: solIconPx, height: solIconPx }}
                  />
                ) : null}
                <span
                  className={cn(
                    'truncate font-semibold tabular-nums leading-none',
                    pnlPositive ? 'text-signal-bull' : 'text-signal-bear',
                  )}
                  style={{ fontSize: valueFontPx }}
                >
                  {isLoading ? '…' : pnlPrimary}
                </span>
              </div>
              <span
                className="mt-1 block font-medium uppercase tracking-wide text-white/45"
                style={{ fontSize: labelFontPx }}
              >
                {pnlLabel}
              </span>
              {prefs.showAltCurrency && !isLoading ? (
                <span
                  className="mt-0.5 block tabular-nums text-white/40"
                  style={{ fontSize: Math.max(7, Math.round(9 * scale)) }}
                >
                  {prefs.swapUsdAndSol
                    ? formatPnlTerminal(totalPnlUsd, 'usd')
                    : formatPnlTerminal(totalPnlSol, 'sol')}
                </span>
              ) : null}
            </div>
          </div>

          <div
            className={cn(
              'mt-2 h-[2px] w-full rounded-full',
              pnlPositive ? 'bg-signal-bull/90 shadow-[0_0_12px_rgba(61,220,151,0.55)]' : 'bg-signal-bear/80',
            )}
            aria-hidden
          />
        </div>
      </div>
      ) : null}

      <PnlTrackerSettingsModal />
    </>
  );
}
