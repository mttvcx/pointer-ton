'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, LineChart } from 'lucide-react';
import { explorerAddressUrl, shortenAddress } from '@/lib/utils/addresses';
import { formatNumber, formatRelativeTime } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import type { TraderMintHoverStats } from '@/lib/trading/mintTopTraders';
import { syntheticTraderMintStats } from '@/lib/dev/demoTokenFixtures';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';
import { useWalletLabels } from '@/lib/hooks/useWalletLabels';
import { Skeleton } from '@/components/shared/Skeleton';
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
  const [modal, setModal] = useState(false);
  const hoverT = useRef<number | null>(null);
  const uiDemo = useUiDemoMode();
  const { resolveLabel } = useWalletLabels();

  const statsQ = useQuery({
    queryKey: ['trader-mint-stats', mint, wallet],
    queryFn: async (): Promise<{ stats: TraderMintHoverStats | null }> => {
      const r = await fetch(
        `/api/tokens/${encodeURIComponent(mint)}/trader-stats?wallet=${encodeURIComponent(wallet)}`,
      );
      if (!r.ok) throw new Error('stats');
      return r.json() as Promise<{ stats: TraderMintHoverStats | null }>;
    },
    enabled: Boolean(!uiDemo && mint && wallet && (hover || modal)),
    staleTime: 20_000,
  });

  const stats: TraderMintHoverStats | null | undefined = uiDemo
    ? syntheticTraderMintStats(wallet)
    : statsQ.data?.stats;

  const statsLoading = !uiDemo && modal && statsQ.isFetching && !statsQ.data;

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
          onClick={() => setModal(true)}
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

      {modal ? (
        <TraderWalletModal
          wallet={wallet}
          sym={sym}
          stats={stats ?? null}
          statsLoading={statsLoading}
          onClose={() => setModal(false)}
        />
      ) : null}
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

function TraderWalletModal({
  wallet,
  sym,
  stats,
  statsLoading,
  onClose,
}: {
  wallet: string;
  sym: string;
  stats: TraderMintHoverStats | null;
  statsLoading: boolean;
  onClose: () => void;
}) {
  const { resolveLabel } = useWalletLabels();
  const openWalletIntel = useWalletIntelStore((s) => s.openWallet);
  const disp = resolveLabel(wallet);
  const title = disp?.labeled ? disp.label : shortenAddress(wallet, 5);

  useEffect(() => {
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const pnl = stats?.realized_pnl_usd ?? 0;
  const pnlTone = pnl >= 0 ? 'text-signal-bull' : 'text-signal-bear';

  return (
    <div className="fixed inset-0 z-[500] flex animate-in fade-in items-center justify-center bg-black/60 p-4 duration-200">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div
        className="relative z-10 flex max-h-[88vh] w-full max-w-lg animate-in zoom-in-95 fade-in flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-base shadow-2xl duration-200"
        role="dialog"
        aria-labelledby="tw-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border-subtle px-4 py-3">
          <h2 id="tw-modal-title" className="text-sm font-semibold text-fg-primary">
            {title}
          </h2>
          <p className="mt-0.5 break-all tabular-nums text-[10px] text-fg-muted" title={wallet}>
            {wallet}
          </p>
          <p className="mt-1 text-[10px] text-fg-secondary">
            Activity on <span className="font-semibold text-fg-primary">{sym}</span> (indexed trades)
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-[11px]">
          {statsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : stats ? (
            <dl className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border-subtle p-2">
                <dt className="text-[9px] uppercase text-fg-muted">Buys</dt>
                <dd className="tabular-nums text-signal-bull">
                  {`$${formatNumber(stats.buy_usd, { decimals: 2 })} \u00b7 ${stats.buy_count} tx`}
                </dd>
              </div>
              <div className="rounded-md border border-border-subtle p-2">
                <dt className="text-[9px] uppercase text-fg-muted">Sells</dt>
                <dd className="tabular-nums text-signal-bear">
                  {`$${formatNumber(stats.sell_usd, { decimals: 2 })} \u00b7 ${stats.sell_count} tx`}
                </dd>
              </div>
              <div className="col-span-2 rounded-md border border-border-subtle p-2">
                <dt className="text-[9px] uppercase text-fg-muted">Realized PnL (FIFO)</dt>
                <dd className={cn('tabular-nums text-lg font-semibold', pnlTone)}>
                  {pnl >= 0 ? '+' : ''}
                  {`$${formatNumber(pnl, { decimals: 2 })}`}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-fg-muted">No confirmed trades for this wallet on this token yet.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border-subtle px-4 py-3">
          <button
            type="button"
            className="btn-press inline-flex items-center gap-1 rounded-md bg-accent-primary px-3 py-1.5 text-[11px] font-semibold text-fg-inverse"
            onClick={() => {
              openWalletIntel({ address: wallet, chain: 'sol' });
              onClose();
            }}
          >
            <LineChart className="h-3.5 w-3.5" />
            Full wallet
          </button>
          <a
            href={explorerAddressUrl(wallet)}
            target="_blank"
            rel="noreferrer"
            className="btn-press inline-flex items-center gap-1 rounded-md border border-border-subtle px-3 py-1.5 text-[11px] text-fg-secondary"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Explorer
          </a>
          <button
            type="button"
            onClick={onClose}
            className="btn-press ml-auto rounded-md border border-border-subtle px-3 py-1.5 text-[11px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
