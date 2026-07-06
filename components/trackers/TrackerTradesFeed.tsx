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
import { ArrowDownRight, ArrowUpRight, BarChart3, Check, Copy, ExternalLink, Settings2, TrendingUp, X, Zap } from 'lucide-react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useUIStore } from '@/store/ui';
import { useWalletIntelStore } from '@/store/walletIntelStore';
import { appChainForWalletAddress } from '@/lib/chains/walletIntelChain';
import { appChainForMintNavigation } from '@/lib/chains/mintKind';
import { formatCompactUsd, formatNumber, formatRelativeTime } from '@/lib/utils/formatters';
import { useTraderMintHoverStats } from '@/lib/hooks/useTraderMintHoverStats';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import { useWalletTrackerPreviewStore } from '@/store/walletTrackerPreview';
import { useWalletQuickBuyStore } from '@/store/walletQuickBuy';
import { useTradesTableSettings, type TradesColumn } from '@/store/tradesTableSettings';
import { SolGlyph } from '@/components/chains/SolGlyph';
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
  tokenAgeLabel?: string | null;
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

function solscanTxUrl(sig: string): string {
  return `https://solscan.io/tx/${encodeURIComponent(sig)}`;
}

/** Compact "3s / 48s / 6m / 2h" since a timestamp. */
function agoShort(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'now';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Amount with the official Solana mark (SOL) or a $ prefix (USD). */
function AmountValue({ usd, sol, unit }: { usd: number | null; sol: number | null; unit: 'SOL' | 'USD' }) {
  if (unit === 'USD') {
    return <>{usd != null ? `$${usd.toLocaleString('en-US', { maximumFractionDigits: usd < 1000 ? 2 : 0 })}` : '—'}</>;
  }
  if (sol == null) return <>—</>;
  return (
    <span className="inline-flex items-center gap-0.5">
      {formatNumber(sol, { decimals: sol >= 1 ? 2 : 3 })}
      <SolGlyph size={11} />
    </span>
  );
}

/* ── column layout ─────────────────────────────────────────────────────── */
type ColKey = 'time' | TradesColumn;
const COL_WIDTH: Record<ColKey, string> = {
  time: '44px',
  status: '16px',
  name: 'minmax(60px, 1fr)',
  token: 'minmax(92px, 1.35fr)',
  amount: 'minmax(66px, auto)',
  marketCap: 'minmax(50px, auto)',
  averageBuy: 'minmax(54px, auto)',
  averageSell: 'minmax(54px, auto)',
};
const COL_ORDER: ColKey[] = ['time', 'status', 'name', 'token', 'amount', 'marketCap', 'averageBuy', 'averageSell'];

function useGridTemplate(columns: Record<TradesColumn, boolean>): { template: string; visible: ColKey[] } {
  const visible = COL_ORDER.filter((c) => c === 'time' || columns[c]);
  return { template: visible.map((c) => COL_WIDTH[c]).join(' '), visible };
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

/* ── wallet-name hover popover (token-specific, Axiom-style) ─────────────── */
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

  // Real per-(wallet, mint) stats for the hovered trade's token — how this wallet
  // has traded THIS token (buys/sells/PnL). Demo rows carry `tokenStats` inline.
  const { stats: realStats, isLoading: statsLoading } = useTraderMintHoverStats(
    t.mint,
    t.wallet,
    true,
  );
  const SOL_USD = 165; // rough conversion for the SOL toggle (amounts are real in USD)
  const s: {
    buysUsd: number; buysSol: number; buysCount: number;
    sellsUsd: number; sellsSol: number; sellsCount: number;
    pnlUsd: number; pnlSol: number;
    holdingUsd: number | null; holdingPct: number | null;
    holderSince: string;
  } | null = t.tokenStats
    ? { ...t.tokenStats, holdingUsd: t.tokenStats.holdingUsd, holdingPct: t.tokenStats.holdingPct }
    : realStats
      ? {
          buysUsd: realStats.buy_usd,
          buysSol: realStats.buy_usd / SOL_USD,
          buysCount: realStats.buy_count,
          sellsUsd: realStats.sell_usd,
          sellsSol: realStats.sell_usd / SOL_USD,
          sellsCount: realStats.sell_count,
          pnlUsd: realStats.realized_pnl_usd,
          pnlSol: realStats.realized_pnl_usd / SOL_USD,
          holdingUsd: null,
          holdingPct: null,
          holderSince: realStats.first_trade_at ? formatRelativeTime(realStats.first_trade_at) : '—',
        }
      : null;

  if (!pos) return null;
  const fmtVal = (usd: number, sol: number) =>
    unit === 'USD' ? (
      `$${usd.toLocaleString('en-US', { maximumFractionDigits: usd < 1000 ? 1 : 0 })}`
    ) : (
      <span className="inline-flex items-center gap-0.5">
        {formatNumber(sol, { decimals: sol >= 1 ? 2 : 3 })}
        <SolGlyph size={10} />
      </span>
    );

  return createPortal(
    <div
      className="fixed z-[240] w-[264px] overflow-hidden rounded-xl border border-border-subtle bg-bg-raised p-2 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.85)]"
      style={{ left: pos.left, top: pos.top }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      role="dialog"
    >
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

      {/* This wallet's activity on the hovered token. */}
      <div className="mb-1 flex items-center gap-1 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-fg-muted">
        <span className="truncate">{tokenLabel(t)}</span>
        <span className="text-fg-muted/50">· this wallet</span>
      </div>

      {s ? (
        <>
          <div className="grid grid-cols-3 gap-1">
            <div className="rounded-lg border border-white/[0.05] bg-white/[0.03] px-2 py-1.5">
              <div className="flex items-center gap-1 text-[12px] font-bold tabular-nums text-signal-bull">
                <ArrowDownRight className="h-3 w-3" strokeWidth={2.5} />
                {fmtVal(s.buysUsd, s.buysSol)}
              </div>
              <div className="mt-0.5 text-[9.5px] text-fg-muted">{s.buysCount} Buy{s.buysCount === 1 ? '' : 's'}</div>
            </div>
            <div className="rounded-lg border border-white/[0.05] bg-white/[0.03] px-2 py-1.5">
              <div className="flex items-center gap-1 text-[12px] font-bold tabular-nums text-signal-bear">
                <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
                {fmtVal(s.sellsUsd, s.sellsSol)}
              </div>
              <div className="mt-0.5 text-[9.5px] text-fg-muted">{s.sellsCount} Sell{s.sellsCount === 1 ? '' : 's'}</div>
            </div>
            <div className="rounded-lg border border-white/[0.05] bg-white/[0.03] px-2 py-1.5">
              <div className={cn('flex items-center gap-1 text-[12px] font-bold tabular-nums', s.pnlUsd >= 0 ? 'text-signal-bull' : 'text-signal-bear')}>
                <TrendingUp className="h-3 w-3" strokeWidth={2.5} />
                {s.pnlUsd >= 0 ? '+' : ''}
                {fmtVal(Math.abs(s.pnlUsd), Math.abs(s.pnlSol))}
              </div>
              <div className="mt-0.5 text-[9.5px] text-fg-muted">PnL</div>
            </div>
          </div>
          <div className={cn('mt-1 grid gap-1', s.holdingUsd != null ? 'grid-cols-2' : 'grid-cols-1')}>
            {s.holdingUsd != null ? (
              <div className="rounded-lg border border-white/[0.05] bg-white/[0.03] px-2 py-1.5">
                <div className="text-[12px] font-bold tabular-nums text-fg-primary">
                  {unit === 'USD' ? (
                    `$${s.holdingUsd.toLocaleString('en-US')}`
                  ) : (
                    <span className="inline-flex items-center gap-0.5">
                      {formatNumber(s.holdingUsd / SOL_USD, { decimals: 2 })}
                      <SolGlyph size={11} />
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[9.5px] text-fg-muted">{s.holdingPct ?? 0}% holding</div>
              </div>
            ) : null}
            <div className="rounded-lg border border-white/[0.05] bg-white/[0.03] px-2 py-1.5">
              <div className="text-[12px] font-bold tabular-nums text-fg-primary">{s.holderSince}</div>
              <div className="mt-0.5 text-[9.5px] text-fg-muted">First traded</div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-white/[0.05] bg-white/[0.03] px-2.5 py-3 text-center text-[11px] text-fg-muted">
          {statsLoading ? 'Loading token activity…' : 'No prior trades on this token.'}
        </div>
      )}

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
  const openWallet = useWalletIntelStore((s) => s.openWallet);
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
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openWallet({ address: t.wallet, chain: appChainForWalletAddress(t.wallet) });
        }}
        className={cn(
          'cursor-pointer truncate text-left text-[11.5px] font-medium underline decoration-dotted decoration-1 underline-offset-2 transition hover:decoration-solid hover:brightness-110',
          t.side === 'buy' ? 'text-signal-bull' : 'text-signal-bear',
        )}
        title={`Open ${name} overview`}
      >
        {name}
      </button>
      {open ? <WalletHoverCard anchor={ref} t={t} onEnter={scheduleOpen} onLeave={scheduleClose} /> : null}
    </span>
  );
}

/* ── time cell with styled Solscan tooltip ─────────────────────────────── */
function TimeCell({ t }: { t: TrackerTrade }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [tip, setTip] = useState<{ left: number; top: number } | null>(null);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setTip({ left: r.left + r.width / 2, top: r.top });
  };
  return (
    <>
      <button
        ref={ref}
        type="button"
        onMouseEnter={show}
        onMouseLeave={() => setTip(null)}
        onClick={(e) => {
          e.stopPropagation();
          setTip(null);
          window.open(solscanTxUrl(t.signature), '_blank', 'noopener,noreferrer');
        }}
        className="justify-self-start text-[10px] font-medium tabular-nums text-fg-secondary underline decoration-dotted decoration-fg-muted/50 underline-offset-2 transition-colors hover:text-fg-primary"
      >
        {agoShort(t.blockTime)}
      </button>
      {tip && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[280] flex -translate-x-1/2 -translate-y-full flex-col items-center"
              style={{ left: tip.left, top: tip.top - 6 }}
            >
              <span className="whitespace-nowrap rounded-md border border-white/[0.1] bg-[#0a0a0a] px-2 py-1 text-[10px] font-medium text-fg-secondary shadow-xl shadow-black/60">
                Open in Solscan
              </span>
              <span className="-mt-[3px] h-1.5 w-1.5 rotate-45 border-b border-r border-white/[0.1] bg-[#0a0a0a]" aria-hidden />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/* ── one trade row ─────────────────────────────────────────────────────── */
function TradeRow({
  t,
  template,
  columns,
  unit,
  zebra = false,
  index = 0,
}: {
  t: TrackerTrade;
  template: string;
  columns: Record<TradesColumn, boolean>;
  unit: 'SOL' | 'USD';
  /** Undocked (free-floating) tracker: drop the green/red row tint for zebra striping (Axiom). */
  zebra?: boolean;
  index?: number;
}) {
  const quickBuy = useQuickBuy();
  const router = useRouter();
  const buy = t.side === 'buy';
  const stats = t.tokenStats;
  const avgBuy = stats && stats.buysCount ? stats.buysSol / stats.buysCount : null;
  const avgBuyUsd = stats && stats.buysCount ? stats.buysUsd / stats.buysCount : null;
  const avgSell = stats && stats.sellsCount ? stats.sellsSol / stats.sellsCount : null;
  const avgSellUsd = stats && stats.sellsCount ? stats.sellsUsd / stats.sellsCount : null;

  return (
    <div
      className={cn(
        'group relative grid items-center gap-2 border-b border-l-[3px] border-b-white/[0.06] px-2 py-2 transition-colors',
        zebra
          ? // Undocked: no green/red row fill — zebra striping (every other row a touch lighter).
            cn('border-l-transparent hover:bg-white/[0.06]', index % 2 === 1 ? 'bg-white/[0.03]' : 'bg-transparent')
          : buy
            ? 'border-l-signal-bull/80 bg-signal-bull/[0.06] hover:bg-signal-bull/[0.13]'
            : 'border-l-signal-bear/80 bg-signal-bear/[0.06] hover:bg-signal-bear/[0.13]',
      )}
      style={{ gridTemplateColumns: template }}
    >
      {/* Time — click opens Solscan; hover shows the styled hint */}
      <TimeCell t={t} />

      {columns.status ? (
        buy ? (
          <ArrowDownRight className="h-3.5 w-3.5 text-signal-bull" strokeWidth={2.5} aria-label="Buy" />
        ) : (
          <ArrowUpRight className="h-3.5 w-3.5 text-signal-bear" strokeWidth={2.5} aria-label="Sell" />
        )
      ) : null}

      {columns.name ? (
        <div className="min-w-0">
          <WalletNameCell t={t} />
        </div>
      ) : null}

      {columns.token ? (
        <div className="flex min-w-0 items-center gap-1.5">
          {t.imageUrl ? (
            <HoverZoomImage src={t.imageUrl} className="h-6 w-6 shrink-0 rounded-md" previewW={200} />
          ) : (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-[9px] font-bold text-fg-muted">
              {(t.symbol ?? '?').replace(/^\$/, '').slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="flex min-w-0 flex-col leading-tight">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/token/${encodeURIComponent(t.mint)}`);
              }}
              className="truncate text-left text-[11.5px] font-semibold text-fg-primary transition-colors hover:text-accent-primary"
              title={t.mint}
            >
              {tokenLabel(t)}
            </button>
            {t.tokenAgeLabel ? <span className="text-[9px] tabular-nums text-fg-muted/90">{t.tokenAgeLabel}</span> : null}
          </span>
        </div>
      ) : null}

      {columns.amount ? (
        <div className={cn('justify-self-end text-right text-[11px] font-semibold tabular-nums', buy ? 'text-signal-bull' : 'text-signal-bear')}>
          <AmountValue usd={t.usdAmount} sol={t.solAmount} unit={unit} />
        </div>
      ) : null}

      {columns.marketCap ? (
        <div className="justify-self-end text-right text-[10.5px] font-medium tabular-nums text-fg-secondary">
          {t.marketCapUsd != null ? formatCompactUsd(t.marketCapUsd) : '—'}
        </div>
      ) : null}

      {columns.averageBuy ? (
        <div className="justify-self-end text-right text-[10.5px] tabular-nums text-signal-bull/90">
          {avgBuy != null ? <AmountValue usd={avgBuyUsd} sol={avgBuy} unit={unit} /> : '—'}
        </div>
      ) : null}

      {columns.averageSell ? (
        <div className="justify-self-end text-right text-[10.5px] tabular-nums text-signal-bear/90">
          {avgSell != null ? <AmountValue usd={avgSellUsd} sol={avgSell} unit={unit} /> : '—'}
        </div>
      ) : null}

      {/* Quick buy — floats in on hover (Axiom ⚡) */}
      <button
        type="button"
        onClick={(e) => quickBuy(e, t.mint)}
        className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-accent-primary/[0.16] text-accent-primary opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-accent-primary/30"
        title="Quick buy"
        aria-label={`Quick buy ${tokenLabel(t)}`}
      >
        <Zap className="h-[18px] w-[18px]" strokeWidth={2.5} />
      </button>
    </div>
  );
}

/* ── column header ─────────────────────────────────────────────────────── */
function TradesHeader({
  template,
  columns,
  unit,
  onToggleUnit,
  onOpenSettings,
}: {
  template: string;
  columns: Record<TradesColumn, boolean>;
  unit: 'SOL' | 'USD';
  onToggleUnit: () => void;
  onOpenSettings: () => void;
}) {
  const hcls = 'text-[9px] font-semibold uppercase tracking-wide text-fg-secondary';
  return (
    <div
      className="grid items-center gap-2 border-b border-white/[0.12] bg-bg-hover/70 px-2 py-1.5"
      style={{ gridTemplateColumns: template }}
    >
      <button
        type="button"
        onClick={onOpenSettings}
        title="Live trades table settings"
        aria-label="Table settings"
        className="justify-self-start text-fg-muted transition-colors hover:text-fg-primary"
      >
        <Settings2 className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
      {columns.status ? <span /> : null}
      {columns.name ? <span className={hcls}>Name</span> : null}
      {columns.token ? <span className={hcls}>Token</span> : null}
      {columns.amount ? (
        <button
          type="button"
          onClick={onToggleUnit}
          title="Toggle SOL / USD"
          className={cn(hcls, 'inline-flex items-center gap-1 justify-self-end transition-colors hover:text-fg-secondary')}
        >
          Amount
          <span className="inline-flex items-center rounded bg-white/[0.08] px-1 py-px text-[8px] normal-case tracking-normal text-fg-secondary">
            {unit === 'SOL' ? <SolGlyph size={10} /> : '$'}
          </span>
        </button>
      ) : null}
      {columns.marketCap ? <span className={cn(hcls, 'justify-self-end')}>$MC</span> : null}
      {columns.averageBuy ? <span className={cn(hcls, 'justify-self-end')}>Avg Buy</span> : null}
      {columns.averageSell ? <span className={cn(hcls, 'justify-self-end')}>Avg Sell</span> : null}
    </div>
  );
}

/* ── settings modal (column visibility) ────────────────────────────────── */
const COL_LABELS: Array<{ key: TradesColumn; label: string }> = [
  { key: 'status', label: 'Status' },
  { key: 'name', label: 'Name' },
  { key: 'token', label: 'Token' },
  { key: 'amount', label: 'Amount' },
  { key: 'marketCap', label: 'Market Cap' },
  { key: 'averageBuy', label: 'Average Buy' },
  { key: 'averageSell', label: 'Average Sell' },
];

function TradesSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const columns = useTradesTableSettings((s) => s.columns);
  const setColumn = useTradesTableSettings((s) => s.setColumn);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-[320px] overflow-hidden rounded-xl border border-white/[0.1] bg-bg-raised shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
          <h3 className="text-[13px] font-semibold text-fg-primary">Live Trades Table Settings</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="btn-press group/close flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-signal-bear/15 hover:text-signal-bear">
            <X className="h-4 w-4 transition-transform group-hover/close:rotate-90" strokeWidth={2.25} />
          </button>
        </header>
        <div className="space-y-1 px-3 py-3">
          {COL_LABELS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="switch"
              aria-checked={columns[key]}
              onClick={() => setColumn(key, !columns[key])}
              className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.03]"
            >
              <span className="text-[12.5px] text-fg-secondary">{label}</span>
              <span className={cn('inline-flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors', columns[key] ? 'bg-accent-primary/80' : 'bg-white/[0.14]')}>
                <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', columns[key] ? 'translate-x-4' : 'translate-x-0')} />
              </span>
            </button>
          ))}
        </div>
        <div className="px-3 pb-3">
          <button type="button" onClick={onClose} className="btn-press w-full rounded-lg bg-accent-primary py-2 text-[12px] font-bold text-fg-inverse hover:bg-accent-glow">
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Live trades from the user's tracked wallets — Axiom-style color-coded table.
 * Auto-refreshes but PAUSES while hovered; Preview streams sample trades.
 */
export function TrackerTradesFeed({ className, zebra = false }: { className?: string; zebra?: boolean }) {
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { authenticated, getAccessToken } = usePointerAuth();
  const preview = useWalletTrackerPreviewStore((s) => s.preview);
  const columns = useTradesTableSettings((s) => s.columns);
  const amountUnit = useTradesTableSettings((s) => s.amountUnit);
  const toggleAmountUnit = useTradesTableSettings((s) => s.toggleAmountUnit);
  const { template } = useGridTemplate(columns);

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
      <div className="flex shrink-0 items-center justify-between px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          Tracked wallets
        </span>
        <span className="inline-flex items-center gap-1">
          <span className={cn('h-1.5 w-1.5 rounded-full', paused ? 'bg-fg-muted' : 'animate-pulse bg-signal-bull')} />
          {paused ? 'Paused' : 'Live'}
        </span>
      </div>

      <TradesHeader
        template={template}
        columns={columns}
        unit={amountUnit}
        onToggleUnit={toggleAmountUnit}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <div
        className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {preview ? (
          trades.map((t, i) => (
            <TradeRow key={`${t.signature}:${t.side}:${t.wallet}`} t={t} template={template} columns={columns} unit={amountUnit} zebra={zebra} index={i} />
          ))
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
          trades.map((t, i) => (
            <TradeRow key={`${t.signature}:${t.side}:${t.wallet}`} t={t} template={template} columns={columns} unit={amountUnit} zebra={zebra} index={i} />
          ))
        )}
      </div>

      <TradesSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
