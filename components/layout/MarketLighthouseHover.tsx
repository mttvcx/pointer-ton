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
import Link from 'next/link';
import {
  ArrowRightLeft,
  BarChart2,
  Flame,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ProtocolBrandIcon } from '@/components/tokens/ProtocolBrandIcon';
import { cn } from '@/lib/utils/cn';
import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';
import {
  getMarketLighthouseSnapshot,
  marketLighthouseHasData,
  type LighthouseTf,
  type LighthouseVenueIcon,
  type LighthouseVenueRow,
} from '@/lib/market/marketLighthouseSnapshot';

const TF_ORDER: LighthouseTf[] = ['5m', '1h', '6h', '24h'];

const PANEL_WIDTH_PX = 340;
/** Above dock peek panels (z-220) and bottom chrome; below app modals (z-280). */
const LIGHTHOUSE_Z = 230;

/** Exit animation duration — keep in sync with panel transition classes below. */
const PANEL_TRANSITION_MS = 220;

const VENUE_TOOLTIP_CLASS = cn(
  'z-[240] rounded-md border border-white/[0.08] bg-[#1a1a1a] px-2.5 py-1.5',
  'whitespace-nowrap text-[11.5px] font-normal text-white/80 shadow-lg shadow-black/50',
);

/** Virtual Curve pill — diagonal stripes (not a solid “error” red dot). */
const METEORA_STRIPE_BG =
  'bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.12)_0,rgba(255,255,255,0.12)_2px,transparent_2px,transparent_5px)] bg-gradient-to-br from-orange-600/50 to-rose-900/40';

function formatPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  const abs = Math.abs(pct);
  const decimals = abs > 0 && abs < 10 ? 3 : 2;
  return `${sign}${pct.toFixed(decimals)}%`;
}

function volLabelForTf(tf: LighthouseTf): string {
  if (tf === '24h') return '24h Vol';
  return `${tf} Vol`;
}

export type LighthousePlacement = 'above' | 'below';

export function MarketLighthouseHover({
  activeChain,
  placement = 'below',
  triggerClassName,
}: {
  activeChain: AppChainId;
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
  const hasData = useMemo(() => marketLighthouseHasData(snap), [snap]);

  const visibleLaunchpads = useMemo(
    () =>
      snap.launchpads.filter(
        (row) =>
          row.key !== 'moonshot' ||
          (row.volumeUsd != null && row.volumeUsd > 0 && row.volumeLabel !== '—'),
      ),
    [snap.launchpads],
  );

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
    const half = PANEL_WIDTH_PX / 2;
    const edge = 8;
    const centerX = Math.max(
      half + edge,
      Math.min(window.innerWidth - half - edge, r.left + r.width / 2),
    );
    if (placement === 'below') {
      setPos({
        left: centerX,
        top: r.bottom + gap,
        bottom: null,
      });
    } else {
      setPos({
        left: centerX,
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
        role="region"
        aria-label="Market Lighthouse"
        className={cn(
          'fixed flex max-h-[520px] w-[340px] select-none flex-col gap-1.5 overflow-y-auto rounded-xl border border-white/[0.06]',
          'z-[230] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          'bg-[#0a0a0a] p-3 text-[11px] font-medium tabular-nums text-white shadow-2xl shadow-black/60',
          'ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform]',
          'transition-[opacity,transform] duration-[220ms]',
          panelEntered ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        style={{
          left: pos.left,
          zIndex: LIGHTHOUSE_Z,
          ...(pos.top != null ? { top: pos.top } : {}),
          ...(pos.bottom != null ? { bottom: pos.bottom } : {}),
          transform: `translateX(-50%) translateY(${panelEntered ? 0 : hiddenSlideY}px)`,
        }}
        onMouseEnter={onEnterPanel}
        onMouseLeave={onLeavePanel}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/90 shadow-[0_0_8px_rgba(52,211,153,0.35)]"
            />
            <span className="truncate text-[12px] font-medium text-white/90">Market Lighthouse</span>
          </div>
          <div className="flex shrink-0 gap-0.5">
            {TF_ORDER.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setTf(tab)}
                className={cn(
                  'rounded-md px-2 py-0.5 text-[10px] font-semibold tabular-nums tracking-wide transition-colors',
                  tf === tab
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/40 hover:text-white/60',
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {!hasData ? (
          <p className="text-center text-[11px] leading-snug text-white/40">
            Hover a token row for market context.
          </p>
        ) : null}

        {hasData ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <StatCard
                label="Trades"
                icon={<BarChart2 className="h-3.5 w-3.5 text-white/40" strokeWidth={1.5} />}
                value={snap.trades.label}
                pct={snap.trades.pct}
              />
              <StatCard
                label="Traders"
                icon={<Users className="h-3.5 w-3.5 text-white/40" strokeWidth={1.5} />}
                value={snap.traders.label}
                pct={snap.traders.pct}
              />
            </div>

            <div className="rounded-lg bg-white/[0.04] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-white/40">
                  {volLabelForTf(tf)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-[12px] font-medium text-white">{snap.volume.headline}</span>
                  <PctChange pct={snap.volume.pct} className="text-[11px]" />
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="flex h-full w-full">
                  <div
                    className="h-full rounded-l-full bg-emerald-400"
                    style={{ width: `${snap.volume.buyPct}%` }}
                  />
                  <div className="h-full flex-1 rounded-r-full bg-red-400" />
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-[10.5px] text-emerald-400">{snap.volume.buyDetail}</span>
                <span className="text-[10.5px] text-red-400">{snap.volume.sellDetail}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-white/[0.04] pt-3">
              <StatCard
                label="Created"
                icon={<Flame className="h-3.5 w-3.5 text-white/40" strokeWidth={1.5} />}
                value={snap.tokens.created.label}
                pct={snap.tokens.created.pct}
              />
              <StatCard
                label="Migrated"
                icon={<ArrowRightLeft className="h-3.5 w-3.5 text-white/40" strokeWidth={1.5} />}
                value={snap.tokens.migrations.label}
                pct={snap.tokens.migrations.pct}
              />
            </div>

            <div className="border-t border-white/[0.04] pt-3">
              <p className="mb-1.5 text-[10px] uppercase tracking-widest text-white/30">
                Top Launchpads
              </p>
              <div className="-mx-0.5 flex gap-2 overflow-x-auto pb-0.5">
                {visibleLaunchpads.map((row) => (
                  <VenuePill key={row.key} row={row} />
                ))}
              </div>
            </div>

            <div className="border-t border-white/[0.04] pt-3">
              <p className="mb-1.5 text-[10px] uppercase tracking-widest text-white/30">
                Top Protocols
              </p>
              <div className="-mx-0.5 flex gap-2 overflow-x-auto pb-0.5">
                {snap.protocols.map((row) => (
                  <VenuePill key={row.key} row={row} />
                ))}
              </div>
            </div>
          </>
        ) : null}
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
        <Link
          href="/pulse"
          prefetch
          aria-label="Open Pulse"
          className={cn(
            'market-lighthouse-trigger pointer-events-auto inline-flex h-[26px] items-center gap-1 rounded-md',
            'border border-border-subtle bg-bg-hover px-1.5',
            'outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/38 focus-visible:ring-offset-0',
            triggerClassName,
          )}
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
        </Link>
      </span>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </>
  );
}

function PctChange({ pct, className }: { pct: number; className?: string }) {
  const pos = pct >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-medium tabular-nums',
        pos ? 'text-emerald-400' : 'text-red-400',
        className,
      )}
    >
      {pos ? (
        <TrendingUp className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
      ) : (
        <TrendingDown className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
      )}
      {formatPct(pct)}
    </span>
  );
}

function StatCard({
  label,
  icon,
  value,
  pct,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  pct: number;
}) {
  return (
    <div className="rounded-lg bg-white/[0.04] p-2.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] uppercase tracking-wide text-white/40">{label}</span>
      </div>
      <div className="mt-1 text-[15px] font-medium text-white">{value}</div>
      <PctChange pct={pct} className="mt-0.5 text-[11px]" />
    </div>
  );
}

function VenueIcon({ row }: { row: LighthouseVenueRow }) {
  const cls = 'h-5 w-5 shrink-0';

  switch (row.icon) {
    case 'pump-fun':
      return <ProtocolBrandIcon protocolId="pump.fun" dotClassName={cls} />;
    case 'bonk':
      return <ProtocolBrandIcon protocolId="bonk" dotClassName={cls} />;
    case 'moonshot':
      return <ProtocolBrandIcon protocolId="moonshot" dotClassName={cls} />;
    case 'raydium-clmm':
      return <ProtocolBrandIcon protocolId="raydium" dotClassName={cls} />;
    case 'virtual-curve':
    case 'meteora-stripe':
      return <ProtocolBrandIcon protocolId="meteora" dotClassName={cls} className={METEORA_STRIPE_BG} />;
    case 'chain-logo':
      return (
        <img
          src={row.iconSrc ?? CHAIN_ICON_PNG.sol}
          alt=""
          className={cn(cls, 'rounded-full object-contain')}
          draggable={false}
          aria-hidden
        />
      );
    default:
      return null;
  }
}

function VenuePill({ row }: { row: LighthouseVenueRow }) {
  const pos = row.pct >= 0;

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'flex min-w-[90px] shrink-0 cursor-default flex-col items-start gap-0.5 rounded-xl',
            'bg-white/[0.04] p-2.5 transition-colors hover:bg-white/[0.06]',
          )}
        >
          <VenueIcon row={row} />
          <span className="mt-1 text-[13px] font-medium tabular-nums text-white">
            {row.volumeLabel}
          </span>
          <span
            className={cn(
              'text-[11px] font-medium tabular-nums',
              pos ? 'text-emerald-400' : 'text-red-400',
            )}
          >
            {formatPct(row.pct)}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className={VENUE_TOOLTIP_CLASS}>
        {row.tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
