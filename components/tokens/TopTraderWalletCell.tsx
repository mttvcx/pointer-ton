'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { shortenAddress } from '@/lib/utils/addresses';
import { formatNumber, formatRelativeTime } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import { appChainForWalletAddress } from '@/lib/chains/walletIntelChain';
import type { TraderMintHoverStats } from '@/lib/trading/mintTopTraders';
import { syntheticTraderMintStats } from '@/lib/dev/demoTokenFixtures';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';
import { useWalletLabels } from '@/lib/hooks/useWalletLabels';
import { useWalletIntelStore } from '@/store/walletIntelStore';

export function TopTraderWalletCell({
  mint,
  wallet,
  sym,
}: {
  mint: string;
  wallet: string;
  sym: string;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [hover, setHover] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const hoverT = useRef<number | null>(null);
  const uiDemo = useUiDemoMode();
  const { resolveLabel } = useWalletLabels();
  const openWalletIntel = useWalletIntelStore((s) => s.openWallet);

  const statsQ = useQuery({
    queryKey: ['trader-mint-stats', mint, wallet],
    queryFn: async (): Promise<{ stats: TraderMintHoverStats | null }> => {
      const r = await fetch(
        `/api/tokens/${encodeURIComponent(mint)}/trader-stats?wallet=${encodeURIComponent(wallet)}`,
      );
      if (!r.ok) throw new Error('stats');
      return r.json() as Promise<{ stats: TraderMintHoverStats | null }>;
    },
    enabled: Boolean(!uiDemo && mint && wallet && hover),
    staleTime: 20_000,
  });

  const stats: TraderMintHoverStats | null | undefined = uiDemo
    ? syntheticTraderMintStats(wallet)
    : statsQ.data?.stats;

  const showPeek = hover && coords && stats;

  const onEnter = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ x: r.left, y: r.bottom + 6 });
    hoverT.current = window.setTimeout(() => setHover(true), 140);
  }, []);

  const onLeave = useCallback(() => {
    if (hoverT.current) window.clearTimeout(hoverT.current);
    hoverT.current = null;
    setHover(false);
    setCoords(null);
  }, []);

  useEffect(() => {
    if (!hover) return;
    function pos() {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setCoords({ x: r.left, y: r.bottom + 6 });
    }
    window.addEventListener('scroll', pos, true);
    window.addEventListener('resize', pos);
    return () => {
      window.removeEventListener('scroll', pos, true);
      window.removeEventListener('resize', pos);
    };
  }, [hover]);

  const disp = resolveLabel(wallet);
  const displayText = disp?.labeled ? disp.label : disp?.text ?? shortenAddress(wallet, 4);

  return (
    <>
      <span ref={anchorRef} className="relative inline-block">
        <button
          type="button"
          className="tabular-nums text-accent-primary hover:underline"
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          onFocus={onEnter}
          onBlur={onLeave}
          onClick={() => {
            openWalletIntel({
              address: wallet,
              chain: appChainForWalletAddress(wallet),
              rowDemo: true,
            });
          }}
        >
          {displayText}
        </button>
      </span>

      {showPeek && coords
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[400] w-[min(18rem,calc(100vw-20px))] animate-in fade-in zoom-in-95 rounded-lg border border-border-subtle bg-bg-hover/98 px-3 py-2 text-[10px] shadow-2xl backdrop-blur-md duration-150"
              style={{ left: coords.x, top: coords.y }}
              role="tooltip"
            >
              <TraderStatsPeek
                wallet={wallet}
                labelTitle={disp?.labeled ? disp.label : null}
                sym={sym}
                stats={stats!}
              />
            </div>,
            document.body,
          )
        : null}

    </>
  );
}

function TraderStatsPeek({
  wallet,
  labelTitle,
  sym,
  stats,
}: {
  wallet: string;
  labelTitle: string | null;
  sym: string;
  stats: TraderMintHoverStats;
}) {
  const pnlTone =
    stats.realized_pnl_usd >= 0 ? 'text-signal-bull' : 'text-signal-bear';
  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle/80 pb-1.5 tabular-nums text-[9px] text-fg-secondary">
        <span className="min-w-0 truncate" title={wallet}>
          {labelTitle ? `${labelTitle} \u00b7 ` : ''}
          {shortenAddress(wallet, 5)}
        </span>
        <span className="shrink-0 text-fg-muted">
          USD{'\u00b7'} {sym}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-md border border-border-subtle/80 bg-bg-base/80 px-1 py-1">
          <div className="text-signal-bull">{'\u2193'} Buys</div>
          <div className="tabular-nums font-semibold tabular-nums text-signal-bull">
            {`$${formatNumber(stats.buy_usd, { decimals: 1 })}`}
          </div>
          <div className="text-[8px] text-fg-muted">{stats.buy_count} buys</div>
        </div>
        <div className="rounded-md border border-border-subtle/80 bg-bg-base/80 px-1 py-1">
          <div className="text-signal-bear">{'\u2191'} Sells</div>
          <div className="tabular-nums font-semibold tabular-nums text-signal-bear">
            {`$${formatNumber(stats.sell_usd, { decimals: 1 })}`}
          </div>
          <div className="text-[8px] text-fg-muted">{stats.sell_count} sells</div>
        </div>
        <div className="rounded-md border border-border-subtle/80 bg-bg-base/80 px-1 py-1">
          <div className={cn('font-semibold', pnlTone)}>PnL</div>
          <div className={cn('tabular-nums font-semibold tabular-nums', pnlTone)}>
            {stats.realized_pnl_usd >= 0 ? '+' : ''}
            {`$${formatNumber(stats.realized_pnl_usd, { decimals: 1 })}`}
          </div>
          <div className="text-[8px] text-fg-muted">
            {stats.win_rate != null
              ? `${formatNumber(stats.win_rate * 100, { decimals: 0 })}% wins`
              : '\u2014'}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 border-t border-border-subtle/60 pt-1.5 text-[8px] text-fg-muted">
        <span>
          Holder since{' '}
          {stats.first_trade_at ? formatRelativeTime(stats.first_trade_at) : '\u2014'}
        </span>
      </div>
    </div>
  );
}
