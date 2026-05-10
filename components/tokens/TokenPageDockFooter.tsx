'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import {
  Activity,
  ArrowLeftRight,
  CircleDollarSign,
  Compass,
  Radio,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { formatNumber, lamportsToSol } from '@/lib/utils/formatters';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { mintMatchesAppChain } from '@/lib/chains/mintKind';
import { useTradingStore } from '@/store/trading';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';

function DockNav({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-[#6b7280] transition hover:bg-white/5 hover:text-[#d1d5db]"
    >
      <Icon className="h-3 w-3 opacity-90" strokeWidth={2} />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

/**
 * Token-page dock: Axiom-style shortcuts above the global app BottomBar.
 * Does not replace BottomBar; stacks in document flow on the token screen.
 */
export function TokenPageDockFooter({ mint, symbol }: { mint: string; symbol: string | null }) {
  const { getAccessToken, authenticated } = usePointerAuth();
  const { activePresetSlot } = useTradingStore();
  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);

  const walletsQ = useQuery({
    queryKey: ['wallets-my'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/wallets/my', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('wallets');
      return res.json() as Promise<{ wallets: MyWalletRow[] }>;
    },
    enabled: authenticated,
    staleTime: 30_000,
  });

  const { activeAddress } = useActiveSolanaWallet(walletsQ.data?.wallets);

  const portfolioQ = useQuery({
    queryKey: ['dock-portfolio', activeChain, activeAddress],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const q = activeAddress ? `?wallet=${encodeURIComponent(activeAddress)}` : '';
      const res = await fetch(`/api/portfolio${q}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('portfolio');
      return res.json() as Promise<{ solLamports: string | null }>;
    },
    enabled: Boolean(
      authenticated &&
        activeAddress &&
        activeChain === 'sol' &&
        mintMatchesAppChain(activeAddress, 'sol'),
    ),
    staleTime: 25_000,
  });

  const tickerSymbol =
    activeChain === 'sol'
      ? 'SOL'
      : activeChain === 'ton'
        ? 'TON'
        : activeChain === 'bnb'
          ? 'BNB'
          : activeChain === 'base'
            ? 'ETH'
            : 'SOL';

  const tickersQ = useQuery({
    queryKey: ['dock-native-usd', tickerSymbol],
    queryFn: async () => {
      const res = await fetch('/api/prices/tickers');
      const j = (await res.json()) as { tickers?: { symbol: string; usdPrice: number | null }[] };
      return j.tickers?.find((t) => t.symbol === tickerSymbol)?.usdPrice ?? null;
    },
    staleTime: 60_000,
  });

  const solBal =
    portfolioQ.data?.solLamports != null
      ? lamportsToSol(BigInt(portfolioQ.data.solLamports))
      : null;
  const nativeUsd = tickersQ.data;

  return (
    <div className="flex w-full shrink-0 flex-col gap-0.5 border-t border-[#1b1f2a] bg-[#0b0d12] px-2 py-1 text-[10px] text-[#9ca3af]">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="hidden font-semibold uppercase tracking-wide text-[#4b5563] sm:inline">
          Dock
        </span>
        <span className="max-w-[8rem] truncate text-[10px] text-[#6b7280]" title={mint}>
          {symbol ?? '-'}{' '}
          <span className="tabular-nums opacity-70">
            {mint.slice(0, 4)}...
          </span>
        </span>
        <span className="rounded border border-[#1b1f2a] px-1.5 py-px tabular-nums text-[10px] text-[#5eead4]">
          PRESET {activePresetSlot}
        </span>
        <div className="hidden h-3 w-px bg-[#1b1f2a] sm:block" aria-hidden />
        <DockNav href="/wallets" icon={Wallet} label="Wallet" />
        <DockNav href="/trackers" icon={Users} label="Track" />
        <DockNav href="/pulse" icon={Compass} label="Pulse" />
        <DockNav href="/portfolio" icon={CircleDollarSign} label="PnL" />
        <DockNav href="/points" icon={Sparkles} label="Alpha" />
        <div className="ml-auto flex flex-wrap items-center gap-x-2 tabular-nums">
          <span className="inline-flex items-center gap-0.5 text-[#6b7280]">
            <ArrowLeftRight className="h-3 w-3" strokeWidth={2} />
            {nativeSym} ${nativeUsd != null ? formatNumber(nativeUsd, { decimals: 2 }) : '-'}
          </span>
          <span>
            Bal{' '}
            <span className="tabular-nums text-[#e5e7eb]">
              {activeChain === 'sol' && solBal != null
                ? `${formatNumber(solBal, { decimals: 3 })} ${nativeSym}`
                : activeChain === 'sol'
                  ? '-'
                  : '—'}
            </span>
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[9px] font-semibold',
              'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
            )}
          >
            <Radio className="h-2.5 w-2.5" strokeWidth={2} />
            RPC
          </span>
          <span className="text-[#4b5563]">US</span>
          <span className="text-[#4b5563]" title="Placeholder">
            <Activity className="inline h-3 w-3" strokeWidth={2} />
          </span>
        </div>
      </div>
    </div>
  );
}
