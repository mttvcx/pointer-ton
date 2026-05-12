'use client';

import Link from 'next/link';
import { ExternalLink, Sparkles } from 'lucide-react';
import {
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { openCopilotQuickAsk } from '@/lib/copilot/quickAsk';
import { usePulseQuickBuy } from '@/lib/hooks/usePulseQuickBuy';
import { BUY_PRESETS_SOL } from '@/lib/utils/constants';
import type { BubbleAccent, TokenExploreItem } from '@/types/explore';
import { formatCompactUsd } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import { usePulseColumnStore } from '@/store/pulseColumns';
import { BUBBLE_CLICK_THRESHOLD_PX } from '@/components/explore/hooks/useBubbleForceSimulation';

function accentStyles(accent: BubbleAccent): {
  ring: string;
  glow: string;
  tint: string;
  label: string;
} {
  switch (accent) {
    case 'bull':
      return {
        ring: 'border-teal-400/45',
        glow: 'shadow-[0_0_52px_-10px_rgba(45,212,191,0.5)]',
        tint: 'from-teal-400/16 via-teal-500/5 to-transparent',
        label: 'Flow / wallets',
      };
    case 'social':
      return {
        ring: 'border-violet-400/45',
        glow: 'shadow-[0_0_52px_-10px_rgba(167,139,250,0.48)]',
        tint: 'from-violet-500/16 via-violet-600/5 to-transparent',
        label: 'Social / KOL',
      };
    case 'event':
      return {
        ring: 'border-amber-400/48',
        glow: 'shadow-[0_0_48px_-10px_rgba(251,191,36,0.42)]',
        tint: 'from-amber-400/14 via-amber-500/5 to-transparent',
        label: 'Listing / event',
      };
    case 'risk':
      return {
        ring: 'border-rose-400/48',
        glow: 'shadow-[0_0_44px_-10px_rgba(251,113,133,0.38)]',
        tint: 'from-rose-500/14 via-rose-600/5 to-transparent',
        label: 'Risk elevated',
      };
    default:
      return {
        ring: 'border-sky-400/35',
        glow: 'shadow-[0_0_46px_-12px_rgba(56,189,248,0.32)]',
        tint: 'from-sky-400/12 via-sky-500/4 to-transparent',
        label: 'Mindshare',
      };
  }
}

function monogramHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(h, 31) + seed.charCodeAt(i)) | 0;
  return 164 + Math.abs(h % 132);
}

type Props = {
  item: TokenExploreItem;
  radius: number;
  match: boolean;
  hovered: boolean;
  selected: boolean;
  peerDimmed: boolean;
  anyDragging: boolean;
  reducedMotion: boolean;
  registerEl: (id: string, el: HTMLDivElement | null) => void;
  onHover: (mint: string | null) => void;
  onSelect: (mint: string) => void;
  onOpenTokenPage: (mint: string) => void;
  startDrag: (id: string, clientX: number, clientY: number) => void;
  moveDrag: (id: string, clientX: number, clientY: number) => void;
  endDrag: (id: string) => void;
};

export function ExploreTokenBubble({
  item,
  radius,
  match,
  hovered,
  selected,
  peerDimmed,
  anyDragging,
  reducedMotion,
  registerEl,
  onHover,
  onSelect,
  onOpenTokenPage,
  startDrag,
  moveDrag,
  endDrag,
}: Props) {
  const { authenticated } = usePointerAuth();
  const { buyToken, busyMint } = usePulseQuickBuy();
  const quickSol = usePulseColumnStore((s) => s.byColumn.new.quickBuySol);
  const buyAmt =
    typeof quickSol === 'number' && Number.isFinite(quickSol) && quickSol > 0
      ? quickSol
      : BUY_PRESETS_SOL[1]!;
  const accent = accentStyles(item.bubbleAccent);

  const outerRef = useRef<HTMLDivElement | null>(null);
  const tipId = useId();

  /** Pointer state machine: distinguishes click vs drag without firing both. */
  const pointerStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
    moved: boolean;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  /** Context menu (right-click). Tooltip is suppressed while open. */
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [iconBroken, setIconBroken] = useState(false);
  const [tipCoords, setTipCoords] = useState<{ ax: number; ay: number; placeAbove: boolean } | null>(
    null,
  );

  const showTooltip =
    hovered && match && !isDragging && !anyDragging && !ctxMenu && tipCoords !== null;

  const setBubbleRef = useCallback(
    (el: HTMLDivElement | null) => {
      outerRef.current = el;
      registerEl(item.tokenAddress, el);
    },
    [item.tokenAddress, registerEl],
  );

  /* eslint-disable react-hooks/set-state-in-effect -- reset broken-icon flag when iconUrl changes */
  useEffect(() => {
    setIconBroken(false);
  }, [item.iconUrl]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const moveTip = useCallback(() => {
    const el = outerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ax = r.left + r.width / 2;
    const placeAbove = r.bottom + 220 > window.innerHeight;
    const ay = placeAbove ? r.top - 10 : r.bottom + 10;
    setTipCoords({ ax, ay, placeAbove });
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- tooltip position is driven by external hover/drag state */
  useEffect(() => {
    if (!hovered || ctxMenu || isDragging || anyDragging) {
      setTipCoords(null);
      return;
    }
    moveTip();
    function onWin() {
      moveTip();
    }
    window.addEventListener('scroll', onWin, true);
    window.addEventListener('resize', onWin);
    return () => {
      window.removeEventListener('scroll', onWin, true);
      window.removeEventListener('resize', onWin);
    };
  }, [hovered, ctxMenu, isDragging, anyDragging, moveTip]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // ignore right/middle clicks here; context menu is handled separately
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const el = e.currentTarget;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* some browsers throw on capture in rare cases — safe to ignore */
      }
      pointerStateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        dragging: false,
        moved: false,
      };
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const s = pointerStateRef.current;
      if (!s || s.pointerId !== e.pointerId) return;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      const dist = Math.hypot(dx, dy);
      if (!s.dragging && dist > BUBBLE_CLICK_THRESHOLD_PX) {
        s.dragging = true;
        setIsDragging(true);
        onHover(null);
        startDrag(item.tokenAddress, e.clientX, e.clientY);
      }
      if (s.dragging) {
        s.moved = true;
        moveDrag(item.tokenAddress, e.clientX, e.clientY);
      }
    },
    [item.tokenAddress, moveDrag, onHover, startDrag],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const s = pointerStateRef.current;
      if (!s || s.pointerId !== e.pointerId) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      if (s.dragging) {
        endDrag(item.tokenAddress);
        setIsDragging(false);
        /* Cursor may no longer be over the bubble after a long drag; clear
         * the global hover so a stale tooltip doesn't reappear. */
        onHover(null);
      } else {
        /* Pure click → open drawer (AI Overview is the first card inside). */
        onSelect(item.tokenAddress);
      }
      pointerStateRef.current = null;
    },
    [endDrag, item.tokenAddress, onHover, onSelect],
  );

  const handlePointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const s = pointerStateRef.current;
      if (!s || s.pointerId !== e.pointerId) return;
      if (s.dragging) {
        endDrag(item.tokenAddress);
        setIsDragging(false);
      }
      pointerStateRef.current = null;
    },
    [endDrag, item.tokenAddress],
  );

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
    onHover(item.tokenAddress);
  }

  const scale = isDragging
    ? 1.07
    : hovered || selected
      ? reducedMotion
        ? 1.025
        : 1.05
      : match
        ? 1
        : 0.92;
  const opacity = match ? (peerDimmed ? 0.42 : 1) : 0.34;
  const ringFocus =
    item.confidenceLevel === 'high'
      ? 'ring-[2px] ring-white/[0.16]'
      : item.confidenceLevel === 'medium'
        ? 'ring-[1.5px] ring-dashed ring-white/[0.12]'
        : 'ring-1 ring-white/[0.08]';
  const hue = monogramHue(item.tokenAddress);

  const buyDisabled = !authenticated || busyMint !== null;
  const buyTitle = !authenticated
    ? 'Sign in to trade'
    : busyMint
      ? 'Executing…'
      : `Quick buy ${buyAmt} SOL`;

  const tooltip = showTooltip
    ? createPortal(
        <div
          role="tooltip"
          id={tipId}
          className={cn(
            'pointer-events-auto z-[10060] w-[min(296px,calc(100vw-28px))] rounded-xl border border-white/[0.1]',
            'bg-[rgba(10,15,26,0.96)] px-3.5 py-3 shadow-[0_20px_50px_-16px_rgba(0,0,0,0.85)] backdrop-blur-xl',
          )}
          style={{
            position: 'fixed',
            left: Math.max(160, Math.min(window.innerWidth - 160, tipCoords!.ax)),
            top: tipCoords!.ay,
            transform: tipCoords!.placeAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
          }}
          onMouseEnter={() => onHover(item.tokenAddress)}
        >
          <div className="flex gap-2.5">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-black/35 ring-1 ring-white/[0.1]">
              {item.iconUrl && !iconBroken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.iconUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={() => setIconBroken(true)}
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-[11px] font-bold text-white/90"
                  style={{
                    background: `linear-gradient(145deg, hsla(${hue},70%,52%,0.95), hsla(${hue + 32},62%,26%,1))`,
                  }}
                >
                  {item.ticker.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold uppercase tracking-[0.04em] text-fg-primary">
                {item.ticker}
              </div>
              <div className="truncate text-[11px] text-fg-secondary">{item.name}</div>
              <div className="mt-1 text-[11px] text-fg-muted">
                <span className="font-medium text-fg-secondary">
                  {formatCompactUsd(item.marketCap)}
                </span>{' '}
                <span className="opacity-75">MC</span>
                {' · '}
                <span className="font-medium tabular-nums text-accent-primary/95">
                  {item.mindshareScore.toFixed(1)}
                </span>{' '}
                <span className="opacity-75">Mindshare</span>
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-fg-muted/90">
                {accent.label}
              </div>
              <p className="mt-1.5 line-clamp-3 text-[10.5px] leading-snug text-fg-muted">
                {item.hoverOneLiner}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-2">
            <span className="text-[10px] text-fg-muted/85">
              <span className="text-accent-primary/90">Click</span> for AI overview
              {' · '}
              <span className="opacity-80">drag to reorganize</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="rounded-md border border-white/[0.1] px-2 py-0.5 text-[10px] font-semibold text-fg-primary transition hover:bg-white/[0.05]"
                onClick={() => onOpenTokenPage(item.tokenAddress)}
              >
                Full page
              </button>
              <button
                type="button"
                disabled={buyDisabled || busyMint === item.tokenAddress}
                title={buyTitle}
                className="rounded-md bg-accent-primary/92 px-2 py-0.5 text-[10px] font-semibold text-fg-inverse transition hover:bg-accent-primary disabled:opacity-35"
                onClick={() => void buyToken(item.tokenAddress, buyAmt)}
              >
                Buy {buyAmt} SOL
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div
        ref={setBubbleRef}
        role="button"
        tabIndex={0}
        aria-expanded={selected}
        aria-describedby={showTooltip ? tipId : undefined}
        aria-grabbed={isDragging}
        className={cn(
          'absolute left-0 top-0 select-none rounded-full outline-none will-change-transform',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        style={{
          width: radius * 2,
          height: radius * 2,
          touchAction: 'none',
          zIndex: isDragging ? 80 : selected ? 60 : hovered ? 45 : Math.round(item.mindshareScore),
        }}
        data-mint={item.tokenAddress}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onMouseEnter={() => {
          if (isDragging || anyDragging) return;
          onHover(item.tokenAddress);
        }}
        onMouseLeave={() => {
          if (isDragging) return;
          if (!ctxMenu) onHover(null);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onOpenTokenPage(item.tokenAddress);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(item.tokenAddress);
          }
        }}
        onContextMenu={handleContextMenu}
      >
        <div
          className={cn(
            'relative h-full w-full select-none rounded-full',
            reducedMotion
              ? 'transition-[opacity,transform,filter] duration-150'
              : 'transition-[opacity,transform,filter] duration-300',
          )}
          style={{
            transform: `scale(${scale})`,
            opacity,
            filter:
              isDragging || hovered || selected
                ? 'saturate(1.08) brightness(1.06)'
                : peerDimmed
                  ? 'saturate(0.85) brightness(0.9)'
                  : 'saturate(0.96) brightness(1)',
          }}
        >
          {/* Specular rim */}
          <div
            className={cn(
              'pointer-events-none absolute -inset-px rounded-full opacity-85',
              'bg-[conic-gradient(from_230deg,rgba(255,255,255,0.12),transparent_38%,transparent_62%,rgba(255,255,255,0.06))]',
            )}
          />
          <div
            className={cn(
              'relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-full border',
              'bg-gradient-to-br from-[#101826]/92 via-[#0B1018]/88 to-black/75',
              accent.ring,
              accent.glow,
              ringFocus,
              selected && 'ring-2 ring-accent-primary/55 shadow-[0_0_28px_-8px_rgba(56,189,248,0.45)]',
              isDragging &&
                'ring-2 ring-accent-primary/65 shadow-[0_0_38px_-6px_rgba(56,189,248,0.5)]',
            )}
          >
            <div
              className={cn(
                `pointer-events-none absolute inset-[2px] rounded-full bg-gradient-to-b ${accent.tint} opacity-[0.9]`,
              )}
            />
            <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.14),transparent_52%)] opacity-55" />

            <div className="relative z-[1] h-[43%] w-[43%] max-h-[118px] max-w-[118px] shrink-0 overflow-hidden rounded-full shadow-[inset_0_-2px_8px_rgba(0,0,0,0.45)] ring-2 ring-black/55">
              {item.iconUrl && !iconBroken ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.iconUrl}
                  alt=""
                  className="pointer-events-none h-full w-full object-cover"
                  draggable={false}
                  loading="lazy"
                  onError={() => setIconBroken(true)}
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-[15px] font-bold tracking-[0.04em]"
                  style={{
                    color: 'rgba(255,255,255,0.92)',
                    background: `linear-gradient(145deg, hsla(${hue},68%,53%,1), hsla(${hue + 28},62%,29%,1))`,
                  }}
                >
                  {item.ticker.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="relative z-[1] mt-2 px-3 text-center leading-tight">
              <span
                className="block max-w-[8.8rem] truncate text-[11.5px] font-bold uppercase tracking-[0.06em] text-white/95 drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]"
                style={{
                  fontSize: Math.min(12.5, Math.max(10, radius * 0.14)),
                }}
              >
                {item.ticker}
              </span>
              <span
                className="block font-semibold tabular-nums text-white/68 drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]"
                style={{
                  fontSize: Math.min(11, Math.max(9, radius * 0.118)),
                }}
              >
                {formatCompactUsd(item.marketCap)}
              </span>
            </div>

            {item.signalBadges.length ? (
              <div className="pointer-events-none absolute inset-[-5px] z-[2] rounded-full opacity-[0.95]">
                {item.signalBadges.slice(0, 8).map((b, idx) => {
                  const theta =
                    (-86 + idx * (360 / Math.max(6, item.signalBadges.length + 3))) *
                    (Math.PI / 180);
                  const ox = Math.cos(theta) * (radius * 0.95);
                  const oy = Math.sin(theta) * (radius * 0.95);
                  const color =
                    b === 'risk'
                      ? 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.55)]'
                      : b === 'volume'
                        ? 'bg-teal-300 shadow-[0_0_6px_rgba(45,212,191,0.45)]'
                        : b === 'social'
                          ? 'bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.5)]'
                          : b === 'kol'
                            ? 'bg-violet-200 shadow-[0_0_6px_rgba(196,181,253,0.45)]'
                            : b === 'wallets'
                              ? 'bg-cyan-200 shadow-[0_0_6px_rgba(165,243,252,0.4)]'
                              : b === 'fresh'
                                ? 'bg-teal-200'
                                : b === 'listing'
                                  ? 'bg-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.42)]'
                                  : 'bg-white/70 shadow-sm';
                  return (
                    <span
                      key={b + idx}
                      className={`absolute left-1/2 top-1/2 block h-[6px] w-[6px] rounded-full ${color}`}
                      style={{ transform: `translate(-50%, -50%) translate(${ox}px,${oy}px)` }}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {tooltip}

      {ctxMenu ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[70] cursor-default bg-transparent"
            aria-label="Close menu"
            onClick={() => {
              setCtxMenu(null);
              onHover(null);
            }}
          />
          <div
            className="fixed z-[80] min-w-[188px] overflow-hidden rounded-lg border border-white/10 bg-bg-elevated/95 py-1 text-[12px] shadow-xl backdrop-blur-md"
            style={{
              left: Math.min(window.innerWidth - 200, Math.max(8, ctxMenu.x)),
              top: Math.min(window.innerHeight - 220, Math.max(8, ctxMenu.y)),
            }}
          >
            <Link
              href={`/token/${encodeURIComponent(item.tokenAddress)}`}
              className="flex items-center gap-2 px-3 py-2 hover:bg-bg-hover"
              onClick={() => setCtxMenu(null)}
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open page
            </Link>
            <button
              type="button"
              disabled={busyMint !== null || !authenticated}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-bg-hover disabled:opacity-35"
              onClick={() => {
                setCtxMenu(null);
                void buyToken(item.tokenAddress, buyAmt);
              }}
            >
              Buy ({buyAmt} SOL)
            </button>
            <button
              type="button"
              disabled
              title="Tracked wallet lists ship next — use Pulse watches for now"
              className="flex w-full items-center px-3 py-2 text-left opacity-35"
            >
              Track
            </button>
            <button
              type="button"
              className="flex w-full items-center px-3 py-2 text-left hover:bg-bg-hover"
              onClick={() => {
                setCtxMenu(null);
                void navigator.clipboard.writeText(item.tokenAddress);
              }}
            >
              Copy CA
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-bg-hover disabled:opacity-35"
              disabled={!authenticated}
              title={!authenticated ? 'Sign in' : undefined}
              onClick={() => {
                setCtxMenu(null);
                openCopilotQuickAsk({
                  entity: {
                    type: 'token',
                    id: item.tokenAddress,
                    label: `${item.ticker}: ${formatCompactUsd(item.marketCap)} mcap`,
                  },
                  question: `Give an AI overview of ${item.ticker}: what it is, why it's moving now, narrative, wallet signal, social signal, risks, and what changed recently. Use cautious language and only fields Pointer tracks.`,
                });
              }}
            >
              <Sparkles className="h-3.5 w-3.5 text-accent-primary" /> Ask Co-pilot
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}
