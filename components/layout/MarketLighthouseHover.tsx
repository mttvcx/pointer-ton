'use client';

import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BarChart3, ChartCandlestick, Coins, Link2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import {
  getMarketLighthouseSnapshot,
  type LighthouseTf,
} from '@/lib/market/marketLighthouseSnapshot';

const TF_ORDER: LighthouseTf[] = ['5m', '1h', '6h', '24h'];

/** Exit animation duration — keep in sync with panel transition classes below. */
const PANEL_TRANSITION_MS = 220;

function formatPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  const abs = Math.abs(pct);
  const decimals = abs > 0 && abs < 10 ? 3 : 2;
  return `${sign}${pct.toFixed(decimals)}%`;
}

export type LighthousePlacement = 'above' | 'below';

export function MarketLighthouseHover({
  activeChain,
  placement = 'below',
  triggerClassName,
}: {
  activeChain: AppChainId;
  /** `below` = dropdown under topbar chip; `above` = popup above bottom-bar anchor (legacy). */
  placement?: LighthousePlacement;
  triggerClassName?: string;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const openT = useRef<number | null>(null);
  const closeT = useRef<number | null>(null);
  const exitAnimT = useRef<number | null>(null);
  const panelRenderedRef = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [panelRendered, setPanelRendered] = useState(false);
  const [panelEntered, setPanelEntered] = useState(false);
  const [tf, setTf] = useState<LighthouseTf>('24h');
  const [pos, setPos] = useState<{
    left: number;
    top: number | null;
    bottom: number | null;
  }>({ left: 0, top: null, bottom: null });

  const snap = useMemo(() => getMarketLighthouseSnapshot(activeChain, tf), [activeChain, tf]);
  const chainTicker = nativeTicker(activeChain);
  /** Hidden transform offset: dropdown slides down into place; popup above anchor slides up. */
  const hiddenSlideY = placement === 'below' ? -8 : 10;

  useEffect(() => {
    panelRenderedRef.current = panelRendered;
  }, [panelRendered]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = placement === 'below' ? 8 : 10;
    if (placement === 'below') {
      setPos({
        left: r.left + r.width / 2,
        top: r.bottom + gap,
        bottom: null,
      });
    } else {
      setPos({
        left: r.left + r.width / 2,
        top: null,
        bottom: window.innerHeight - r.top + gap,
      });
    }
  }, [placement]);

  useLayoutEffect(() => {
    if (!panelRendered) return;
    measure();
  }, [panelRendered, measure, activeChain, tf, placement]);

  useEffect(() => {
    if (!panelRendered) return;
    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [panelRendered, measure, placement]);

  const clearTimers = () => {
    if (openT.current != null) {
      window.clearTimeout(openT.current);
      openT.current = null;
    }
    if (closeT.current != null) {
      window.clearTimeout(closeT.current);
      closeT.current = null;
    }
    if (exitAnimT.current != null) {
      window.clearTimeout(exitAnimT.current);
      exitAnimT.current = null;
    }
  };

  const armUnmountAfterTransition = () => {
    if (exitAnimT.current != null) {
      window.clearTimeout(exitAnimT.current);
      exitAnimT.current = null;
    }
    exitAnimT.current = window.setTimeout(() => {
      exitAnimT.current = null;
      setPanelRendered(false);
    }, PANEL_TRANSITION_MS + 24);
  };

  const scheduleOpen = () => {
    clearTimers();
    if (panelRenderedRef.current) {
      setPanelEntered(true);
      requestAnimationFrame(measure);
      return;
    }

    openT.current = window.setTimeout(() => {
      openT.current = null;
      setPanelRendered(true);
      setPanelEntered(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPanelEntered(true));
      });
      requestAnimationFrame(measure);
    }, 72);
  };

  const scheduleClose = () => {
    clearTimers();
    closeT.current = window.setTimeout(() => {
      closeT.current = null;
      setPanelEntered(false);
      armUnmountAfterTransition();
    }, 240);
  };

  const onEnterAnchor = () => {
    clearTimers();
    scheduleOpen();
  };

  const onLeaveAnchor = () => {
    clearTimers();
    scheduleClose();
  };

  const onEnterPanel = () => {
    clearTimers();
  };

  const onLeavePanel = () => {
    clearTimers();
    scheduleClose();
  };

  useEffect(() => () => clearTimers(), []);

  const panel =
    panelRendered && mounted ? (
      <div
        role="tooltip"
        className={cn(
          'fixed z-[62] w-[min(380px,calc(100vw-20px))] select-none rounded-lg border border-border-subtle',
          'bg-bg-raised/98 shadow-[0_14px_44px_-14px_rgba(0,0,0,0.72)] backdrop-blur-md',
          'px-3 pb-3 pt-2.5 text-[11px] font-medium tabular-nums text-fg-primary',
          'ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform]',
          'transition-[opacity,transform] duration-[220ms]',
          panelEntered ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        style={{
          left: pos.left,
          ...(pos.top != null ? { top: pos.top } : {}),
          ...(pos.bottom != null ? { bottom: pos.bottom } : {}),
          transform: `translateX(-50%) translateY(${panelEntered ? 0 : hiddenSlideY}px)`,
        }}
        onMouseEnter={onEnterPanel}
        onMouseLeave={onLeavePanel}
      >
        <div className="mb-2.5 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal-bull/90 shadow-[0_0_8px_rgba(52,211,153,0.35)]" />
            <div className="min-w-0 leading-tight">
              <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-primary">
                Tape
              </span>
              <span className="block truncate text-[10px] font-medium tabular-nums text-fg-muted">
                {chainTicker} rail · aggregate
              </span>
            </div>
          </div>
          <div className="flex shrink-0 gap-0.5 rounded-md bg-bg-hover p-0.5 ring-1 ring-border-subtle">
            {TF_ORDER.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setTf(tab)}
                className={cn(
                  'rounded px-2 py-[3px] text-[10px] font-semibold tabular-nums tracking-wide transition-colors',
                  tf === tab
                    ? 'bg-accent-primary text-fg-inverse'
                    : 'text-fg-muted hover:bg-bg-base hover:text-fg-secondary',
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatTile
            title="Trades"
            icon={<BarChart3 className="h-3.5 w-3.5 text-fg-muted" strokeWidth={2} />}
            value={snap.trades.label}
            pct={snap.trades.pct}
          />
          <StatTile
            title="Traders"
            icon={<ChartCandlestick className="h-3.5 w-3.5 text-fg-muted" strokeWidth={2} />}
            value={snap.traders.label}
            pct={snap.traders.pct}
          />
        </div>

        <div className="mt-2.5 rounded-lg border border-border-subtle bg-bg-base px-2.5 py-2">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-fg-muted">{tf === '24h' ? 'Vol 24h' : `Vol ${tf}`}</span>
            <span className="flex items-center gap-2">
              <span className="font-semibold text-fg-primary">{snap.volume.headline}</span>
              <span
                className={cn(
                  'text-[10px] font-semibold tabular-nums',
                  snap.volume.pct >= 0 ? 'text-signal-bull' : 'text-signal-bear',
                )}
              >
                {formatPct(snap.volume.pct)}
              </span>
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg-hover">
            <div className="flex h-full w-full">
              <div
                className="h-full bg-signal-bull/85"
                style={{ width: `${snap.volume.buyPct}%` }}
              />
              <div className="h-full flex-1 bg-signal-bear/75" />
            </div>
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-2 text-[10px] tabular-nums">
            <span className="font-semibold text-signal-bull">{snap.volume.buyDetail}</span>
            <span className="text-right font-semibold text-signal-bear">{snap.volume.sellDetail}</span>
          </div>
        </div>

        <div className="mt-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
            <Coins className="h-3 w-3 opacity-80" strokeWidth={2} aria-hidden />
            Tokens
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatTile
              title="Created"
              icon={<Sparkles className="h-3.5 w-3.5 text-fg-muted" strokeWidth={2} />}
              value={snap.tokens.created.label}
              pct={snap.tokens.created.pct}
            />
            <StatTile
              title="Migrated"
              icon={<Link2 className="h-3.5 w-3.5 text-fg-muted" strokeWidth={2} />}
              value={snap.tokens.migrations.label}
              pct={snap.tokens.migrations.pct}
            />
          </div>
        </div>

        <div className="mt-2.5">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
            Launchpads
          </div>
          <div className="flex gap-2">
            <LaunchPill row={snap.launchpads[0]} />
            <LaunchPill row={snap.launchpads[1]} />
          </div>
        </div>

        <div className="mt-2.5">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
            DEX
          </div>
          <div className="flex gap-2">
            <LaunchPill row={snap.protocols[0]} />
            <LaunchPill row={snap.protocols[1]} />
          </div>
        </div>
      </div>
    ) : null;

  const dualTapeGlyphs = activeChain === 'sol';

  return (
    <>
      <span
        ref={anchorRef}
        className="relative inline-flex shrink-0"
        onMouseEnter={onEnterAnchor}
        onMouseLeave={onLeaveAnchor}
      >
        <span
          className={cn(
            'pointer-events-auto inline-flex h-[26px] items-center gap-1 rounded-md',
            'border border-border-subtle bg-bg-hover px-1.5 transition-colors hover:bg-white/[0.06]',
            triggerClassName,
          )}
          aria-label={`Tape — ${chainTicker} liquidity snapshot`}
        >
          {dualTapeGlyphs ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- pump.fun chip matches Pulse rows */}
              <img
                src="/icons/pumpfun.webp"
                alt=""
                width={16}
                height={16}
                draggable={false}
                className="h-4 w-4 shrink-0 rounded-full object-cover opacity-95 ring-1 ring-black/35"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={CHAIN_ICON_PNG.sol}
                alt=""
                width={15}
                height={15}
                draggable={false}
                className="h-[15px] w-[15px] shrink-0 bg-transparent object-contain opacity-95"
              />
            </>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- chain selector artwork */}
              <img
                src={CHAIN_ICON_PNG[activeChain]}
                alt=""
                width={18}
                height={18}
                draggable={false}
                className="h-[18px] w-[18px] shrink-0 bg-transparent object-contain opacity-95"
              />
            </>
          )}
        </span>
      </span>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </>
  );
}

function StatTile({
  title,
  icon,
  value,
  pct,
}: {
  title: string;
  icon: ReactNode;
  value: string;
  pct: number;
}) {
  const pos = pct >= 0;
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-base px-2 py-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-fg-muted">
        {icon}
        <span className="truncate">{title}</span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span className="text-[13px] font-semibold tracking-tight text-fg-primary">{value}</span>
        <span className={cn('text-[10px] font-semibold tabular-nums', pos ? 'text-signal-bull' : 'text-signal-bear')}>
          {formatPct(pct)}
        </span>
      </div>
    </div>
  );
}

function LaunchPill({
  row,
}: {
  row: {
    iconSrc: string;
    volumeLabel: string;
    pct: number;
  };
}) {
  const pos = row.pct >= 0;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border-subtle bg-bg-base px-2 py-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={row.iconSrc}
        alt=""
        width={18}
        height={18}
        draggable={false}
        className="h-[18px] w-[18px] shrink-0 bg-transparent object-contain"
      />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[11px] font-semibold text-fg-primary">{row.volumeLabel}</div>
        <div className={cn('text-[10px] font-semibold tabular-nums', pos ? 'text-signal-bull' : 'text-signal-bear')}>
          {formatPct(row.pct)}
        </div>
      </div>
    </div>
  );
}
