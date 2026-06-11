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
  Database,
  Flame,
  Users,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ProtocolBrandIcon } from '@/components/tokens/ProtocolBrandIcon';
import { cn } from '@/lib/utils/cn';
import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';
import {
  emptyMarketLighthouseSnapshot,
  marketLighthouseHasData,
  type LighthouseTf,
  type LighthouseVenueRow,
} from '@/lib/market/marketLighthouseSnapshot';
import { useMarketLighthouse } from '@/lib/hooks/useMarketLighthouse';

const TF_ORDER: LighthouseTf[] = ['5m', '1h', '6h', '24h'];

const PANEL_WIDTH_PX = 328;
const LIGHTHOUSE_Z = 230;
const PANEL_TRANSITION_MS = 220;

const PANEL_SURFACE = 'border border-[#2a2a2a] bg-[#141414]';
const CELL_SURFACE = 'border border-[#2a2a2a] bg-[#181818]';

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
  const [tf, setTf] = useState<LighthouseTf>('1h');
  const [pos, setPos] = useState<{
    left: number;
    top: number | null;
    bottom: number | null;
  }>({ left: 0, top: null, bottom: null });

  const { data: snap = emptyMarketLighthouseSnapshot(), isPending } = useMarketLighthouse(activeChain, tf);
  const hasData = useMemo(() => !isPending && marketLighthouseHasData(snap), [isPending, snap]);

  const hiddenSlideY = placement === 'below' ? -6 : 8;

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
      setPos({ left: centerX, top: r.bottom + gap, bottom: null });
    } else {
      setPos({ left: centerX, top: null, bottom: window.innerHeight - r.top + gap });
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
    if (openT.current != null) window.clearTimeout(openT.current);
    if (closeT.current != null) window.clearTimeout(closeT.current);
    if (exitAnimT.current != null) window.clearTimeout(exitAnimT.current);
    openT.current = null;
    closeT.current = null;
    exitAnimT.current = null;
  };

  const armUnmountAfterTransition = () => {
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

  useEffect(() => () => clearTimers(), []);

  const panel =
    panelRendered && mounted ? (
      <div
        role="region"
        aria-label="Market Lighthouse"
        className={cn(
          'fixed w-[328px] select-none overflow-hidden rounded-lg',
          PANEL_SURFACE,
          'z-[230] p-2.5 text-[11px] font-normal tabular-nums text-[#e8e8e8] shadow-[0_12px_40px_-8px_rgba(0,0,0,0.75)]',
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
        onMouseEnter={clearTimers}
        onMouseLeave={scheduleClose}
      >
        {/* Header */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4ade80]" />
            <span className="truncate text-[12px] font-medium text-[#f0f0f0]">Market Lighthouse</span>
          </div>
          <div className="flex shrink-0 gap-0.5">
            {TF_ORDER.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setTf(tab)}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums transition-colors',
                  tf === tab ? 'bg-[#262626] text-[#f0f0f0]' : 'text-[#666] hover:text-[#999]',
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {!hasData ? (
          <p className="py-6 text-center text-[11px] text-[#666]">
            {isPending ? 'Loading market stats…' : 'No market data for this chain.'}
          </p>
        ) : (
          <div className="space-y-2">
            {/* Trades + Traders */}
            <div className="grid grid-cols-2 gap-1.5">
              <StatCell
                label="Total Trades"
                icon={<BarChart2 className="h-3 w-3 text-[#666]" strokeWidth={1.75} />}
                value={snap.trades.label}
                pct={snap.trades.pct}
              />
              <StatCell
                label="Traders"
                icon={<Users className="h-3 w-3 text-[#666]" strokeWidth={1.75} />}
                value={snap.traders.label}
                pct={snap.traders.pct}
              />
            </div>

            {/* Volume */}
            <div className={cn('rounded-md p-2', CELL_SURFACE)}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] text-[#888]">{volLabelForTf(tf)}</span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[12px] font-medium text-[#f0f0f0]">{snap.volume.headline}</span>
                  <PctText pct={snap.volume.pct} />
                </span>
              </div>
              <div className="mt-1.5 flex h-1 overflow-hidden rounded-sm bg-[#262626]">
                <div className="h-full bg-[#4ade80]" style={{ width: `${snap.volume.buyPct}%` }} />
                <div className="h-full flex-1 bg-[#f87171]" />
              </div>
              <div className="mt-1 flex justify-between gap-2 text-[10px]">
                <span className="text-[#4ade80]">{snap.volume.buyDetail}</span>
                <span className="text-[#f87171]">{snap.volume.sellDetail}</span>
              </div>
            </div>

            {/* Token stats */}
            <div>
              <div className="mb-1 flex items-center gap-1 text-[10px] text-[#888]">
                <Database className="h-3 w-3" strokeWidth={1.75} aria-hidden />
                Token Stats
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <StatCell
                  label="Created"
                  icon={<Flame className="h-3 w-3 text-[#666]" strokeWidth={1.75} />}
                  value={snap.tokens.created.label}
                  pct={snap.tokens.created.pct}
                />
                <StatCell
                  label="Migrated"
                  icon={<ArrowRightLeft className="h-3 w-3 text-[#666]" strokeWidth={1.75} />}
                  value={snap.tokens.migrations.label}
                  pct={snap.tokens.migrations.pct}
                />
              </div>
            </div>

            {/* Top launchpads — fixed 3-col, no scroll */}
            <div>
              <p className="mb-1 text-[10px] text-[#666]">Top Launchpads</p>
              <div className="grid grid-cols-3 gap-1.5">
                {snap.launchpads.map((row) => (
                  <VenueCell key={row.key} row={row} />
                ))}
              </div>
            </div>

            {/* Top protocols */}
            <div>
              <p className="mb-1 text-[10px] text-[#666]">Top Protocols</p>
              <div className="grid grid-cols-3 gap-1.5">
                {snap.protocols.map((row) => (
                  <VenueCell key={row.key} row={row} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    ) : null;

  const dualTapeGlyphs = activeChain === 'sol';

  return (
    <>
      <span
        ref={anchorRef}
        className="relative inline-flex shrink-0"
        onMouseEnter={() => {
          clearTimers();
          scheduleOpen();
        }}
        onMouseLeave={scheduleClose}
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/pumpfun.webp"
                alt=""
                width={16}
                height={16}
                draggable={false}
                className="h-4 w-4 shrink-0 rounded-full object-cover opacity-95"
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
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={CHAIN_ICON_PNG[activeChain]}
              alt=""
              width={18}
              height={18}
              draggable={false}
              className="h-[18px] w-[18px] shrink-0 bg-transparent object-contain opacity-95"
            />
          )}
        </Link>
      </span>
      {mounted && panel ? createPortal(panel, document.body) : null}
    </>
  );
}

function PctText({ pct, className }: { pct: number; className?: string }) {
  const pos = pct >= 0;
  return (
    <span
      className={cn(
        'text-[10px] font-normal tabular-nums',
        pos ? 'text-[#4ade80]' : 'text-[#f87171]',
        className,
      )}
    >
      {formatPct(pct)}
    </span>
  );
}

function StatCell({
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
    <div className={cn('rounded-md p-2', CELL_SURFACE)}>
      <div className="flex items-center gap-1">
        {icon}
        <span className="text-[10px] text-[#888]">{label}</span>
      </div>
      <div className="mt-1 text-[14px] font-medium leading-none text-[#f0f0f0]">{value}</div>
      <PctText pct={pct} className="mt-0.5 block" />
    </div>
  );
}

function VenueIcon({ row }: { row: LighthouseVenueRow }) {
  const cls = 'h-[18px] w-[18px] shrink-0';
  if (row.protocolId) {
    return <ProtocolBrandIcon protocolId={row.protocolId} dotClassName={cls} />;
  }
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
      return <ProtocolBrandIcon protocolId="meteora" dotClassName={cls} />;
    case 'chain-logo':
      return (
        // eslint-disable-next-line @next/next/no-img-element
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

function VenueCell({ row }: { row: LighthouseVenueRow }) {
  const pos = row.pct >= 0;
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <div className={cn('flex min-w-0 cursor-default flex-col rounded-md p-1.5', CELL_SURFACE)}>
          <VenueIcon row={row} />
          <span className="mt-1 truncate text-[11px] font-medium text-[#f0f0f0]">{row.volumeLabel}</span>
          <span
            className={cn(
              'text-[10px] tabular-nums',
              pos ? 'text-[#4ade80]' : 'text-[#f87171]',
            )}
          >
            {formatPct(row.pct)}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={4}
        className="rounded border border-[#333] bg-[#1a1a1a] px-2 py-1 text-[11px] text-[#ccc]"
      >
        {row.tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
