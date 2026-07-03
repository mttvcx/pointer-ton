'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, BarChart3, Check, Copy, ExternalLink, TrendingUp, Zap } from 'lucide-react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useUIStore } from '@/store/ui';
import { useWalletIntelStore } from '@/store/walletIntelStore';
import { appChainForWalletAddress } from '@/lib/chains/walletIntelChain';
import { appChainForMintNavigation } from '@/lib/chains/mintKind';
import { formatCompactUsd, formatNumber, formatRelativeTime } from '@/lib/utils/formatters';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { useWalletTrackerPreviewStore } from '@/store/walletTrackerPreview';
import { useWalletQuickBuyStore } from '@/store/walletQuickBuy';
import { makeDemoTrackerTrade, seedDemoTrackerTrades, type TokenPositionStats } from '@/lib/dev/walletTradesDemo';
import { HoverZoomImage } from '@/components/monitor/HoverZoomImage';

type TrackerTrade = {
  signature: string;
  wallet: string;
  walletLabel: string | null;
  mint: string;
  symbol: string | null;
  name: string | null;
  imageUrl: string | null;
  side: 'buy' | 'sell';
  solAmount: number | null;
  usdAmount: number | null;
  marketCapUsd: number | null;
  blockTime: string | null;
  /** The wallet's aggregate position in this token (hover card). Demo-only for now. */
  tokenStats?: TokenPositionStats;
};

const WALLET_EMOJIS = ['🦊', '🐳', '🐸', '🦍', '🐝', '🦅', '🐙', '🦈', '🐺', '🦉', '🐊', '🦂'];

function walletEmoji(addr: string): string {
  let h = 0;
  for (let i = 0; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) >>> 0;
  return WALLET_EMOJIS[h % WALLET_EMOJIS.length]!;
}

function tokenLabel(t: TrackerTrade): string {
  return t.symbol ? `$${t.symbol}` : shortenAddress(t.mint, 4);
}

function useQuickBuy() {
  const router = useRouter();
  const activeChain = useUIStore((s) => s.activeChain);
  return (e: ReactMouseEvent, mint: string) => {
    e.preventDefault();
    e.stopPropagation();
    const amountSol = useWalletQuickBuyStore.getState().amountSol;
    const chain = appChainForMintNavigation(mint, activeChain);
    useUIStore.getState().setActiveChain(chain);
    router.push(`/token/${encodeURIComponent(mint)}?buySol=${encodeURIComponent(String(amountSol))}`);
  };
}

/* ── wallet-name hover popover (portaled, so it never clips the scroll box) ── */
function WalletHoverCard({
  anchor,
  t,
  onEnter,
  onLeave,
}: {
  anchor: React.RefObject<HTMLElement | null>;
  t: TrackerTrade;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [unit, setUnit] = useState<'USD' | 'SOL'>('USD');
  const quickBuyAmount = useWalletQuickBuyStore((s) => s.amountSol);
  const openWallet = useWalletIntelStore((s) => s.openWallet);
  const router = useRouter();
  const quickBuy = useQuickBuy();

  useLayoutEffect(() => {
    const el = anchor.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const W = 264;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - W - 8);
    setPos({ left, top: r.bottom + 6 });
  }, [anchor]);

  if (!pos) return null;
  const s = t.tokenStats;
  const fmtVal = (usd: number, sol: number) =>
    unit === 'USD'
      ? `$${usd.toLocaleString('en-US', { maximumFractionDigits: usd < 1000 ? 1 : 0 })}`
      : `${formatNumber(sol, { decimals: sol >= 1 ? 2 : 3 })}◎`;

  return createPortal(
    <div
      className="fixed z-[240] w-[264px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#0a0a0a] p-2 shadow-2xl shadow-black/60"
      style={{ left: pos.left, top: pos.top }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      role="dialog"
    >
      {/* Header: token this position is for + address copy + SOL/USD toggle */}
      <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void navigator.clipboard?.writeText(t.wallet);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="inline-flex min-w-0 items-center gap-1 text-[11px] font-medium text-fg-secondary transition hover:text-white"
          title={t.wallet}
        >
          <span className="font-mono">{shortenAddress(t.wallet, 4)}</span>
          {copied ? <Check className="h-3 w-3 text-signal-bull" strokeWidth={2} /> : <Copy className="h-3 w-3 opacity-70" strokeWidth={1.8} />}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setUnit((u) => (u === 'USD' ? 'SOL' : 'USD'));
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-fg-muted transition hover:text-fg-secondary"
        >
          {unit}
        </button>
      </div>

      {s ? (
        <>
          <div className="grid grid-cols-3 gap-1">
            <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
              <div className="flex items-center gap-1 text-[12px] font-bold tabular-nums text-signal-bull">
                <ArrowDownRight className="h-3 w-3" strokeWidth={2.5} />
                {fmtVal(s.buysUsd, s.buysSol)}
              </div>
              <div className="mt-0.5 text-[9.5px] text-fg-muted">{s.buysCount} Buy{s.buysCount === 1 ? '' : 's'}</div>
            </div>
            <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
              <div className="flex items-center gap-1 text-[12px] font-bold tabular-nums text-signal-bear">
                <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
                {fmtVal(s.sellsUsd, s.sellsSol)}
              </div>
              <div className="mt-0.5 text-[9.5px] text-fg-muted">{s.sellsCount} Sell{s.sellsCount === 1 ? '' : 's'}</div>
            </div>
            <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
              <div className={cn('flex items-center gap-1 text-[12px] font-bold tabular-nums', s.pnlUsd >= 0 ? 'text-signal-bull' : 'text-signal-bear')}>
                <TrendingUp className="h-3 w-3" strokeWidth={2.5} />
                {s.pnlUsd >= 0 ? '+' : ''}
                {fmtVal(Math.abs(s.pnlUsd), Math.abs(s.pnlSol))}
              </div>
              <div className="mt-0.5 text-[9.5px] text-fg-muted">PnL</div>
            </div>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1">
            <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
              <div className="text-[12px] font-bold tabular-nums text-fg-primary">
                {unit === 'USD' ? `$${s.holdingUsd.toLocaleString('en-US')}` : `${formatNumber(s.holdingUsd / 168, { decimals: 2 })}◎`}
              </div>
              <div className="mt-0.5 text-[9.5px] text-fg-muted">{s.holdingPct}% holding</div>
            </div>
            <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
              <div className="text-[12px] font-bold tabular-nums text-fg-primary">{s.holderSince}</div>
              <div className="mt-0.5 text-[9.5px] text-fg-muted">Holder since</div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2 text-[11px]">
          <span className="text-fg-muted">Last trade</span>
          <span className="flex items-center gap-1 font-semibold text-fg-secondary">
            <span className={t.side === 'buy' ? 'text-signal-bull' : 'text-signal-bear'}>{t.side === 'buy' ? 'Bought' : 'Sold'}</span>
            {tokenLabel(t)}
            {t.solAmount != null ? <span className="tabular-nums text-fg-muted">· {formatNumber(t.solAmount, { decimals: t.solAmount >= 1 ? 2 : 3 })}◎</span> : null}
          </span>
        </div>
      )}

      {/* Bottom actions: quick buy + open wallet dossier + token page */}
      <div className="mt-1.5 flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => quickBuy(e, t.mint)}
          className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md bg-accent-primary/20 text-[11px] font-bold text-accent-primary transition hover:bg-accent-primary/30"
          title={`Quick buy ${quickBuyAmount} SOL`}
        >
          <Zap className="h-3 w-3" strokeWidth={2.5} />
          {quickBuyAmount}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openWallet({ address: t.wallet, chain: appChainForWalletAddress(t.wallet) });
          }}
          className="inline-flex h-7 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.025] text-fg-muted transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
          title="Open wallet dossier"
          aria-label="Open wallet dossier"
        >
          <BarChart3 className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            router.push(`/token/${encodeURIComponent(t.mint)}`);
          }}
          className="inline-flex h-7 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.025] text-fg-muted transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
          title="Open token page"
          aria-label="Open token page"
        >
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>,
    document.body,
  );
}

function WalletNameCell({ t }: { t: TrackerTrade }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const scheduleOpen = () => {
    clear();
    timer.current = setTimeout(() => setOpen(true), 50);
  };
  const scheduleClose = () => {
    clear();
    timer.current = setTimeout(() => setOpen(false), 110);
  };
  const name = t.walletLabel || shortenAddress(t.wallet, 4);

  return (
    <span
      ref={ref}
      className="inline-flex min-w-0 cursor-default items-center gap-1.5"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      <span className="text-[13px] leading-none" aria-hidden>
        {walletEmoji(t.wallet)}
      </span>
      <span
        className={cn(
          'truncate text-[11.5px] font-medium',
          t.side === 'buy' ? 'text-signal-bull' : 'text-signal-bear',
        )}
        title={t.wallet}
      >
        {name}
      </span>
      {open ? <WalletHoverCard anchor={ref} t={t} onEnter={scheduleOpen} onLeave={scheduleClose} /> : null}
    </span>
  );
}

function TradeRow({ t }: { t: TrackerTrade }) {
  const quickBuy = useQuickBuy();
  const router = useRouter();
  const quickBuyAmount = useWalletQuickBuyStore((s) => s.amountSol);
  return (
    <div className="group grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-1.5 transition-colors hover:bg-white/[0.03]">
      <div className="flex min-w-0 items-center gap-2">
        {t.side === 'buy' ? (
          <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-signal-bull" strokeWidth={2.5} aria-label="Buy" />
        ) : (
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-signal-bear" strokeWidth={2.5} aria-label="Sell" />
        )}
        <WalletNameCell t={t} />
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-1.5">
        {t.imageUrl ? (
          <HoverZoomImage src={t.imageUrl} className="h-6 w-6 shrink-0 rounded-md" previewW={200} />
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-[9px] font-bold text-fg-muted">
            {(t.symbol ?? '?').replace(/^\$/, '').slice(0, 2).toUpperCase()}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/token/${encodeURIComponent(t.mint)}`);
          }}
          className="truncate text-[11px] font-semibold text-fg-secondary transition-colors hover:text-fg-primary"
          title={t.mint}
        >
          {tokenLabel(t)}
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right leading-tight">
          <div className="text-[11px] font-semibold tabular-nums text-fg-primary">
            {t.solAmount != null ? `${formatNumber(t.solAmount, { decimals: t.solAmount >= 1 ? 2 : 3 })}◎` : t.usdAmount != null ? formatCompactUsd(t.usdAmount) : '—'}
          </div>
          <div className="text-[9px] tabular-nums text-fg-muted">
            {t.usdAmount != null ? formatCompactUsd(t.usdAmount) : ''}
            {t.blockTime ? <span className="ml-1">{formatRelativeTime(t.blockTime)}</span> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => quickBuy(e, t.mint)}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-primary/[0.14] text-accent-primary opacity-0 transition group-hover:opacity-100 hover:bg-accent-primary/30"
          title={`Quick buy ${quickBuyAmount} SOL`}
          aria-label={`Quick buy ${tokenLabel(t)}`}
        >
          <Zap className="h-3 w-3" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

/**
 * Live trades from the user's tracked wallets. Real parsed swaps (mint_swaps);
 * auto-refreshes every few seconds but PAUSES the refresh while the cursor is
 * over the list so rows don't jump under you (Axiom-style hover-to-inspect).
 */
export function TrackerTradesFeed({ className }: { className?: string }) {
  const [paused, setPaused] = useState(false);
  const { authenticated, getAccessToken } = usePointerAuth();
  const preview = useWalletTrackerPreviewStore((s) => s.preview);

  const q = useQuery({
    queryKey: ['tracker-trades'],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch('/api/trackers/trades?limit=50', {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`trades ${res.status}`);
      const json = (await res.json()) as { trades?: TrackerTrade[] };
      return json.trades ?? [];
    },
    enabled: authenticated && !preview,
    refetchInterval: paused || preview ? false : 15_000,
    refetchIntervalInBackground: false,
    staleTime: 10_000,
    retry: 1,
  });

  // Preview: stream sample trades in (prepend), pausing while hovered like live.
  const [demoTrades, setDemoTrades] = useState<TrackerTrade[]>([]);
  const seqRef = useRef(1000);
  const pausedRef = useRef(false);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    if (!preview) {
      setDemoTrades([]);
      return;
    }
    setDemoTrades(seedDemoTrackerTrades(Date.now()));
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      setDemoTrades((prev) => [makeDemoTrackerTrade(seqRef.current++, Date.now()), ...prev].slice(0, 50));
    }, 3200);
    return () => window.clearInterval(id);
  }, [preview]);

  const trades = preview ? demoTrades : q.data ?? [];

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="flex shrink-0 items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
        <span>
          Live trades · tracked wallets
          {preview ? <span className="ml-1 rounded bg-white/[0.08] px-1 text-[8.5px] normal-case tracking-normal">sample</span> : null}
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              paused ? 'bg-fg-muted' : 'animate-pulse bg-signal-bull',
            )}
          />
          {paused ? 'Paused' : 'Live'}
        </span>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:thin]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {preview ? (
          trades.map((t) => <TradeRow key={`${t.signature}:${t.side}:${t.wallet}`} t={t} />)
        ) : !authenticated ? (
          <p className="px-3 py-6 text-center text-[11px] text-fg-muted">Connect your wallet to see tracked trades.</p>
        ) : q.isLoading ? (
          <p className="px-3 py-6 text-center text-[11px] text-fg-muted">Loading trades…</p>
        ) : q.isError ? (
          <p className="px-3 py-6 text-center text-[11px] text-fg-muted">Couldn&apos;t load trades — retry shortly.</p>
        ) : trades.length === 0 ? (
          <p className="px-3 py-6 text-center text-[11px] leading-relaxed text-fg-muted">
            No trades from your tracked wallets yet.<br />They&apos;ll stream in here as your wallets trade.
          </p>
        ) : (
          trades.map((t) => <TradeRow key={`${t.signature}:${t.side}:${t.wallet}`} t={t} />)
        )}
      </div>
    </div>
  );
}
