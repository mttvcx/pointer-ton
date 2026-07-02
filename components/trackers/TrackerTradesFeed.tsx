'use client';

import {
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, Check, Copy, ExternalLink, Wallet, Zap } from 'lucide-react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useUIStore } from '@/store/ui';
import { useWalletIntelStore } from '@/store/walletIntelStore';
import { appChainForWalletAddress } from '@/lib/chains/walletIntelChain';
import { appChainForMintNavigation } from '@/lib/chains/mintKind';
import { formatCompactUsd, formatNumber, formatRelativeTime } from '@/lib/utils/formatters';
import { shortenAddress } from '@/lib/utils/addresses';
import { BUY_PRESETS_SOL } from '@/lib/utils/constants';
import { cn } from '@/lib/utils/cn';

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
};

const QUICK_BUY_SOL = BUY_PRESETS_SOL[1] ?? BUY_PRESETS_SOL[0] ?? 0.5;
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
    const chain = appChainForMintNavigation(mint, activeChain);
    useUIStore.getState().setActiveChain(chain);
    router.push(`/token/${encodeURIComponent(mint)}?buySol=${encodeURIComponent(String(QUICK_BUY_SOL))}`);
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
  const openWallet = useWalletIntelStore((s) => s.openWallet);
  const router = useRouter();
  const quickBuy = useQuickBuy();

  useLayoutEffect(() => {
    const el = anchor.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const W = 232;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - W - 8);
    setPos({ left, top: r.bottom + 6 });
  }, [anchor]);

  if (!pos) return null;
  const name = t.walletLabel || shortenAddress(t.wallet, 4);

  return createPortal(
    <div
      className="fixed z-[240] w-[232px] overflow-hidden rounded-lg border border-white/[0.08] bg-[#0a0a0a] shadow-2xl shadow-black/60"
      style={{ left: pos.left, top: pos.top }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      role="dialog"
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden>{walletEmoji(t.wallet)}</span>
          <span className="truncate text-[12px] font-semibold text-white" title={t.wallet}>
            {name}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void navigator.clipboard?.writeText(t.wallet);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className={cn(
            'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition',
            copied ? 'text-signal-bull' : 'text-fg-muted hover:bg-white/[0.05] hover:text-white',
          )}
          aria-label={copied ? 'Copied' : 'Copy wallet address'}
        >
          {copied ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.8} />}
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 px-2.5 py-2 text-[11px]">
        <span className="text-fg-muted">Last trade</span>
        <span className="flex items-center gap-1 font-semibold text-fg-secondary">
          <span className={t.side === 'buy' ? 'text-signal-bull' : 'text-signal-bear'}>
            {t.side === 'buy' ? 'Bought' : 'Sold'}
          </span>
          {tokenLabel(t)}
          {t.solAmount != null ? <span className="tabular-nums text-fg-muted">· {formatNumber(t.solAmount, { decimals: t.solAmount >= 1 ? 2 : 3 })}◎</span> : null}
        </span>
      </div>

      <div className="flex items-center gap-1.5 px-2 pb-2">
        <button
          type="button"
          onClick={(e) => quickBuy(e, t.mint)}
          className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md bg-accent-primary/20 text-[11px] font-bold text-accent-primary transition hover:bg-accent-primary/30"
        >
          <Zap className="h-3 w-3" strokeWidth={2.5} />
          {QUICK_BUY_SOL}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openWallet({ address: t.wallet, chain: appChainForWalletAddress(t.wallet) });
          }}
          className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.025] px-2 text-[10px] font-semibold text-[#d1d5db] transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
        >
          <Wallet className="h-3 w-3" strokeWidth={2} />
          Wallet
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            router.push(`/token/${encodeURIComponent(t.mint)}`);
          }}
          className="inline-flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.025] px-2 text-[10px] font-semibold text-[#d1d5db] transition hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white"
        >
          <ExternalLink className="h-3 w-3" strokeWidth={2} />
          Token
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

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          router.push(`/token/${encodeURIComponent(t.mint)}`);
        }}
        className="shrink-0 truncate text-[11px] font-semibold text-fg-secondary transition-colors hover:text-fg-primary"
        title={t.mint}
      >
        {tokenLabel(t)}
      </button>

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
          title={`Quick buy ${QUICK_BUY_SOL} SOL`}
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
    enabled: authenticated,
    refetchInterval: paused ? false : 15_000,
    refetchIntervalInBackground: false,
    staleTime: 10_000,
    retry: 1,
  });

  const trades = q.data ?? [];

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="flex shrink-0 items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
        <span>Live trades · tracked wallets</span>
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
        {!authenticated ? (
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
