'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useCreateWallet } from '@/lib/auth/solanaShims';
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  EyeOff,
  Folder,
  GripVertical,
  Loader2,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import { ImportWalletModal } from '@/components/wallets/ImportWalletModal';
import { explorerTxUrl, shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';
import {
  formatCompactUsd,
  formatNumber,
  formatRelativeTime,
  formatUsd,
  lamportsToSol,
} from '@/lib/utils/formatters';

type PositionRow = {
  mint: string;
  balanceRaw: string;
  decimals: number;
  symbol: string | null;
  imageUrl: string | null;
  costBasisSol: number;
  costBasisUsd: number;
  valueUsd: number | null;
  unrealizedPnlUsd: number | null;
  avgEntrySolPerUiToken: number | null;
};

type ClosedSellRow = {
  tradeId: string;
  mint: string;
  submittedAt: string;
  txSignature: string;
  amountTokenRaw: string;
  solProceeds: number;
  costBasisSol: number;
  realizedPnlUsd: number;
  symbol: string | null;
  decimals: number;
};

type TradeRowApi = {
  id: string;
  mint: string;
  side: 'buy' | 'sell';
  status: string;
  amountSol: number | null;
  txSignature: string;
  submittedAt: string;
};

type PortfolioJson = {
  walletAddress: string | null;
  solLamports: string | null;
  holdings: Array<{
    mint: string;
    rawAmount: string;
    symbol: string | null;
    decimals: number;
    imageUrl: string | null;
  }>;
  solUsd: number | null;
  summary: {
    totalValueUsd: number | null;
    realizedPnlUsd: number;
    unrealizedPnlUsd: number;
    totalPnlUsd: number;
  };
  positions: PositionRow[];
  closedSells: ClosedSellRow[];
  trades: TradeRowApi[];
};

type PortfolioTab = 'spot' | 'wallets';
type SpotTableTab = 'active_positions' | 'history' | 'top100';
type TimeFilter = '1d' | '7d' | '30d' | 'max';
type TickerRow = { symbol: string; usdPrice: number | null; priceChange24h: number | null };

const PANEL = '#121622';
const PANEL2 = '#151826';
const BORDER = '#1b1f2a';
const EMPTY_POSITIONS: PositionRow[] = [];
const EMPTY_CLOSED_SELLS: ClosedSellRow[] = [];
const EMPTY_TRADES: TradeRowApi[] = [];

async function authJson<T>(
  token: string,
  url: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      json && typeof json === 'object' && 'message' in json
        ? String((json as { message: unknown }).message)
        : json && typeof json === 'object' && 'error' in json
          ? String((json as { error: unknown }).error)
          : res.statusText;
    return { ok: false, status: res.status, message };
  }
  return { ok: true, data: json as T };
}

export function PortfolioDashboard({ className }: { className?: string }) {
  const { authenticated, getAccessToken } = usePointerAuth();
  const qc = useQueryClient();
  const { createWallet } = useCreateWallet();
  const [tab, setTab] = useState<PortfolioTab>('spot');
  const [spotTableTab, setSpotTableTab] = useState<SpotTableTab>('active_positions');
  const [searchWallets, setSearchWallets] = useState('');
  const [searchTable, setSearchTable] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [usdMode, setUsdMode] = useState(true);
  const [walletFilter, setWalletFilter] = useState<'all' | 'active'>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30d');
  const [sourceWalletIds, setSourceWalletIds] = useState<string[]>([]);
  const [destinationWalletId, setDestinationWalletId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');

  const myWalletsQ = useQuery({
    queryKey: ['wallets-my'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/wallets/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('wallets');
      return res.json() as Promise<{ wallets: MyWalletRow[] }>;
    },
    enabled: authenticated,
    staleTime: 30_000,
  });

  const { activeAddress, ready: walletsReady } = useActiveSolanaWallet(myWalletsQ.data?.wallets);

  const query = useQuery({
    queryKey: ['portfolio', activeAddress],
    enabled: authenticated && walletsReady,
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const base = '/api/portfolio?tradesLimit=80&fifoLimit=3000';
      const url = activeAddress
        ? `${base}&wallet=${encodeURIComponent(activeAddress)}`
        : base;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof json === 'object' && json && 'message' in json
            ? String((json as { message: unknown }).message)
            : 'portfolio failed',
        );
      }
      return json as PortfolioJson;
    },
  });

  const tickersQ = useQuery({
    queryKey: ['portfolio-page-tickers'],
    queryFn: async (): Promise<TickerRow[]> => {
      const res = await fetch('/api/prices/tickers');
      const j = (await res.json()) as { tickers?: TickerRow[] };
      return j.tickers ?? [];
    },
    staleTime: 30_000,
  });

  const walletRows = useMemo(() => {
    const rows = myWalletsQ.data?.wallets ?? [];
    const q = searchWallets.trim().toLowerCase();
    return rows.filter((w) => {
      if (walletFilter === 'active' && !w.is_active) return false;
      if (!q) return true;
      return (
        w.wallet_address.toLowerCase().includes(q) ||
        (w.label ?? '').toLowerCase().includes(q)
      );
    });
  }, [myWalletsQ.data?.wallets, searchWallets, walletFilter]);
  const allWallets = myWalletsQ.data?.wallets ?? [];
  const sourceWallets = sourceWalletIds
    .map((id) => allWallets.find((w) => w.id === id))
    .filter((w): w is MyWalletRow => Boolean(w));
  const destinationWallet = allWallets.find((w) => w.id === destinationWalletId) ?? null;

  const onDropSource = (id: string) => {
    setDestinationWalletId((current) => (current === id ? null : current));
    setSourceWalletIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  const onDropDestination = (id: string) => {
    setSourceWalletIds((current) => current.filter((walletId) => walletId !== id));
    setDestinationWalletId(id);
  };

  async function persistImportedPointerRow(address: string) {
    const token = await getAccessToken();
    if (!token) throw new Error('no_token');
    const res = await authJson<{ wallet: MyWalletRow }>(token, '/api/wallets/create', {
      method: 'POST',
      body: JSON.stringify({ wallet_address: address, is_imported: true }),
    });
    if (!res.ok && res.status !== 409) throw new Error(res.message);
    void qc.invalidateQueries({ queryKey: ['wallets-my'] });
    void qc.invalidateQueries({ queryKey: ['portfolio'] });
  }

  async function onCreateEmbedded() {
    setCreating(true);
    setCreateMenuOpen(false);
    try {
      const { wallet: w } = await createWallet({ createAdditional: true });
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await authJson<{ wallet: MyWalletRow }>(token, '/api/wallets/create', {
        method: 'POST',
        body: JSON.stringify({ wallet_address: w.address }),
      });
      if (!res.ok && res.status !== 409) throw new Error(res.message);
      toast.success('Wallet created');
      void qc.invalidateQueries({ queryKey: ['wallets-my'] });
      void qc.invalidateQueries({ queryKey: ['portfolio'] });
    } catch (e) {
      toast.error('Could not create wallet', {
        description: e instanceof Error ? e.message : 'Unknown error',
      });
    } finally {
      setCreating(false);
    }
  }

  const positions = query.data?.positions ?? EMPTY_POSITIONS;
  const closed = query.data?.closedSells ?? EMPTY_CLOSED_SELLS;
  const trades = query.data?.trades ?? EMPTY_TRADES;
  const solUi = query.data?.solLamports ? lamportsToSol(BigInt(query.data.solLamports)) : 0;

  const rowsForSpotTable = useMemo(() => {
    if (spotTableTab === 'active_positions') return positions;
    if (spotTableTab === 'history') return closed;
    return [...positions].sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0)).slice(0, 100);
  }, [spotTableTab, positions, closed]);

  const filteredRows = useMemo(() => {
    const q = searchTable.trim().toLowerCase();
    return rowsForSpotTable.filter((r) => {
      const symbol = 'symbol' in r ? (r.symbol ?? '') : '';
      const mint = r.mint ?? '';
      if (!showHidden && 'balanceRaw' in r && r.balanceRaw === '0') return false;
      if (!q) return true;
      return symbol.toLowerCase().includes(q) || mint.toLowerCase().includes(q);
    });
  }, [rowsForSpotTable, searchTable, showHidden]);

  const btc = tickersQ.data?.find((t) => t.symbol === 'BTC');

  if (!authenticated) {
    return (
      <div
        className={cn(
          'rounded-md border border-border-subtle bg-bg-base p-6 text-sm text-fg-secondary',
          className,
        )}
      >
        Sign in to view portfolio.
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className={cn('flex h-full min-h-[320px] items-center justify-center', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-[#5865F2]" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className={cn('rounded border p-3 text-[12px] text-[#f87171]', className)} style={{ borderColor: BORDER, backgroundColor: PANEL }}>
        Could not load portfolio.
      </div>
    );
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col text-[12px] text-white', className)}>
      <div className="flex shrink-0 items-center gap-3 border-b px-2 py-1" style={{ borderColor: BORDER }}>
        {([
          ['spot', 'Spot'],
          ['wallets', 'Wallets'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'relative pb-1 text-[13px] transition',
              tab === id ? 'font-semibold text-white' : 'text-[#6b7280] hover:text-[#d1d5db]',
            )}
          >
            {label}
            {tab === id ? <span className="absolute inset-x-0 -bottom-[1px] h-[2px] rounded-full bg-[#5865F2]" /> : null}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1" style={{ borderColor: BORDER }}>
        <button className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px]" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
          All Wallets
          <ChevronDown className="h-3 w-3" />
        </button>
        <span className="tabular-nums text-[11px] text-[#d1d5db]">{formatNumber(solUi, { decimals: 4 })}</span>
        <div className="ml-auto flex min-w-[230px] items-center gap-1">
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded border px-2 py-1" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
            <Search className="h-3 w-3 text-[#6b7280]" />
            <input
              value={searchWallets}
              onChange={(e) => setSearchWallets(e.target.value)}
              placeholder="Search for other wallets..."
              className="min-w-0 flex-1 border-0 bg-transparent text-[11px] text-white outline-none placeholder:text-[#4b5563]"
            />
          </div>
          {(['1d', '7d', '30d', 'max'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setTimeFilter(f)}
              className={cn('rounded px-1.5 py-1 text-[10px] font-semibold uppercase', timeFilter === f ? 'bg-white/10 text-white' : 'text-[#6b7280] hover:text-[#d1d5db]')}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {tab === 'spot' ? (
        <div className="flex min-h-0 flex-1 flex-col p-1">
          <section className="grid shrink-0 grid-cols-12 overflow-hidden rounded-lg border" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
            <div className="col-span-12 border-b p-2 md:col-span-3 md:border-b-0 md:border-r" style={{ borderColor: BORDER }}>
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">Balance</h3>
              <div className="mt-1.5 space-y-1 text-[11px]">
                <div>
                  <div className="text-[10px] text-[#6b7280]">Total Value</div>
                  <div className="text-[18px] font-semibold tabular-nums text-white">{formatCompactUsd(query.data.summary.totalValueUsd)}</div>
                </div>
                <PerfRow label="Unrealized PNL" value={formatUsd(query.data.summary.unrealizedPnlUsd)} />
                <PerfRow label="Tradeable Balance" value={formatCompactUsd(query.data.summary.totalValueUsd)} />
              </div>
            </div>
            <div className="col-span-12 border-b px-2 py-1.5 md:col-span-6 md:border-b-0 md:border-r" style={{ borderColor: BORDER }}>
              <div className="mb-0.5 flex items-center justify-between">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">Realized PNL</h3>
                <span className="text-[10px] text-[#6b7280]">{timeFilter.toUpperCase()}</span>
              </div>
              <TinyLineChart positive={query.data.summary.realizedPnlUsd >= 0} />
            </div>
            <div className="col-span-12 p-2 md:col-span-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">Performance</h3>
              <div className="mt-1 space-y-1">
                <PerfRow label="30d Total PNL" value={formatUsd(query.data.summary.totalPnlUsd)} />
                <PerfRow label="30d Realized PNL" value={formatUsd(query.data.summary.realizedPnlUsd)} />
                <PerfRow label="30d TXNS" value={String(trades.length)} />
                <PerfRow label="> 500%" value="0" bar={0} />
                <PerfRow label="200% - 500%" value="0" bar={0} />
                <PerfRow label="0% - 200%" value={String(Math.floor(trades.length / 2))} bar={35} />
                <PerfRow label="0% - 50%" value={String(Math.floor(trades.length / 3))} bar={20} />
                <PerfRow label="< -50%" value={String(Math.floor(trades.length / 6))} bar={12} />
              </div>
            </div>
          </section>

          <div className="mt-1 grid min-h-0 flex-1 grid-cols-12 gap-1">
            <section className="col-span-12 flex min-h-0 flex-col rounded border md:col-span-8" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
              <div className="flex flex-wrap items-center gap-1 border-b px-2 py-0.5" style={{ borderColor: BORDER }}>
                {([
                  ['active_positions', 'Active Positions'],
                  ['history', 'History'],
                  ['top100', 'Top 100'],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSpotTableTab(id)}
                    className={cn('relative px-1.5 py-1 text-[11px] font-medium', spotTableTab === id ? 'text-white after:absolute after:inset-x-1 after:bottom-0 after:h-px after:bg-[#5865F2]' : 'text-[#6b7280] hover:text-[#d1d5db]')}
                  >
                    {label}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-1">
                  <div className="flex items-center gap-1 rounded border px-2 py-0.5" style={{ borderColor: BORDER, backgroundColor: '#080d14' }}>
                    <Search className="h-3 w-3 text-[#6b7280]" />
                    <input
                      value={searchTable}
                      onChange={(e) => setSearchTable(e.target.value)}
                      placeholder="Search by name or address"
                      className="w-36 border-0 bg-transparent text-[10px] text-white outline-none placeholder:text-[#4b5563]"
                    />
                  </div>
                  <label className="inline-flex items-center gap-1 text-[10px] text-[#6b7280]">
                    <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="h-3 w-3" />
                    Show Hidden
                  </label>
                  <button onClick={() => setUsdMode((v) => !v)} className="rounded border px-1.5 py-0.5 text-[10px] font-semibold" style={{ borderColor: BORDER }}>
                    {usdMode ? 'USD' : 'TON'}
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead className="sticky top-0" style={{ backgroundColor: PANEL2 }}>
                    <tr className="border-b" style={{ borderColor: BORDER }}>
                      <th className="px-2 py-1 font-semibold uppercase tracking-wide text-[#6b7280]">Token</th>
                      <th className="px-2 py-1 text-right font-semibold uppercase tracking-wide text-[#6b7280]">Bought</th>
                      <th className="px-2 py-1 text-right font-semibold uppercase tracking-wide text-[#6b7280]">Sold</th>
                      <th className="px-2 py-1 text-right font-semibold uppercase tracking-wide text-[#6b7280]">PNL</th>
                      <th className="px-2 py-1 text-right font-semibold uppercase tracking-wide text-[#6b7280]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row, i) => {
                      const mint = row.mint;
                      const symbol = row.symbol ?? shortenAddress(mint, 4);
                      const pnl = 'realizedPnlUsd' in row ? row.realizedPnlUsd : (row.unrealizedPnlUsd ?? 0);
                      const bought = 'costBasisSol' in row ? row.costBasisSol : 0;
                      const sold = 'solProceeds' in row ? row.solProceeds : 0;
                      return (
                        <tr key={`${mint}-${i}`} className="border-b hover:bg-white/[0.04]" style={{ borderColor: BORDER, backgroundColor: i % 2 === 0 ? '#080d14' : '#151826' }}>
                          <td className="px-2 py-1"><div className="flex items-center gap-1.5"><span className="h-4 w-4 rounded bg-[#20263a]" /><span className="font-medium text-white">{symbol}</span></div></td>
                          <td className="px-2 py-1 text-right tabular-nums text-[#34d399]">{usdMode ? formatUsd(bought) : `${formatNumber(bought, { decimals: 4 })} TON`}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-[#fb7185]">{usdMode ? formatUsd(sold) : `${formatNumber(sold, { decimals: 4 })} TON`}</td>
                          <td className={cn('px-2 py-1 text-right tabular-nums', pnl >= 0 ? 'text-[#34d399]' : 'text-[#fb7185]')}>{usdMode ? formatUsd(pnl) : `${formatNumber((pnl ?? 0) / Math.max(1, query.data.solUsd ?? 150), { decimals: 4 })} TON`}</td>
                          <td className="px-2 py-1 text-right"><div className="inline-flex items-center gap-1 text-[#6b7280]"><button className="rounded p-1 hover:bg-white/5"><Copy className="h-3.5 w-3.5" /></button><Link href={`/token/${mint}`} className="rounded p-1 hover:bg-white/5"><ExternalLink className="h-3.5 w-3.5" /></Link></div></td>
                        </tr>
                      );
                    })}
                    {filteredRows.length === 0 ? <PortfolioPlaceholderRows /> : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="col-span-12 flex min-h-0 flex-col rounded border md:col-span-4" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
              <div className="border-b px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]" style={{ borderColor: BORDER }}>Activity</div>
              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full border-collapse text-left text-[10px]">
                  <thead className="sticky top-0" style={{ backgroundColor: PANEL2 }}>
                    <tr className="border-b" style={{ borderColor: BORDER }}>
                      <th className="px-1.5 py-1 text-[#6b7280]">Type</th>
                      <th className="px-1.5 py-1 text-[#6b7280]">Token</th>
                      <th className="px-1.5 py-1 text-right text-[#6b7280]">Amount</th>
                      <th className="px-1.5 py-1 text-right text-[#6b7280]">Market Cap</th>
                      <th className="px-1.5 py-1 text-right text-[#6b7280]">Age</th>
                      <th className="px-1.5 py-1 text-right text-[#6b7280]">Explorer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t, i) => (
                      <tr key={t.id} className="border-b hover:bg-white/[0.04]" style={{ borderColor: BORDER, backgroundColor: i % 2 === 0 ? '#080d14' : '#151826' }}>
                        <td className={cn('px-1.5 py-1', t.side === 'buy' ? 'text-[#34d399]' : 'text-[#fb7185]')}>{t.side.toUpperCase()}</td>
                        <td className="px-1.5 py-1 text-white">{shortenAddress(t.mint, 3)}</td>
                        <td className="px-1.5 py-1 text-right text-[#d1d5db]">{t.amountSol != null ? formatNumber(t.amountSol, { decimals: 3 }) : '—'}</td>
                        <td className="px-1.5 py-1 text-right text-[#6b7280]">—</td>
                        <td className="px-1.5 py-1 text-right text-[#6b7280]">{formatRelativeTime(t.submittedAt)}</td>
                        <td className="px-1.5 py-1 text-right"><a href={explorerTxUrl(t.txSignature)} target="_blank" rel="noreferrer" className="text-[#7dd3fc] hover:underline">↗</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {trades.length === 0 ? (
                  <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-[#4b5563]">
                    <EyeOff className="h-8 w-8" />
                    <p className="mt-2 text-[11px]">No activity</p>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {tab === 'wallets' ? (
        <div className="grid min-h-0 flex-1 grid-cols-12 gap-1 p-1.5">
          <section className="col-span-12 flex min-h-0 flex-col rounded border md:col-span-6" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
            <div className="flex items-center gap-1 border-b px-2 py-1" style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-1 rounded border px-2 py-0.5" style={{ borderColor: BORDER, backgroundColor: '#080d14' }}>
                <Search className="h-3 w-3 text-[#6b7280]" />
                <input value={searchWallets} onChange={(e) => setSearchWallets(e.target.value)} placeholder="Search by name or address" className="w-36 border-0 bg-transparent text-[10px] text-white outline-none placeholder:text-[#4b5563]" />
              </div>
              <label className="ml-1 inline-flex items-center gap-1 text-[10px] text-[#6b7280]">
                <input type="checkbox" checked={walletFilter === 'active'} onChange={(e) => setWalletFilter(e.target.checked ? 'active' : 'all')} className="h-3 w-3" />
                Show Archived
              </label>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="ml-auto rounded border px-2 py-1 text-[10px] font-semibold"
                style={{ borderColor: BORDER }}
              >
                Import
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCreateMenuOpen((v) => !v)}
                  disabled={creating}
                  className="inline-flex items-center gap-1 rounded bg-[#5865F2] px-2 py-1 text-[10px] font-semibold text-[#0a0a0f] disabled:opacity-50"
                >
                  {creating ? 'Creating' : 'Create'} <ChevronDown className="h-3 w-3" />
                </button>
                {createMenuOpen ? (
                  <div
                    className="absolute right-0 top-[calc(100%+6px)] z-40 w-28 rounded border bg-[#17191f] p-1 shadow-2xl"
                    style={{ borderColor: BORDER }}
                  >
                    <button
                      type="button"
                      onClick={() => void onCreateEmbedded()}
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[11px] font-semibold text-[#d1d5db] hover:bg-white/5"
                    >
                      <Wallet className="h-3.5 w-3.5" /> Wallet
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreateMenuOpen(false);
                        toast.info('Wallet groups coming soon');
                      }}
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-[11px] font-semibold text-[#d1d5db] hover:bg-white/5"
                    >
                      <Folder className="h-3.5 w-3.5" /> Group
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full border-collapse text-left text-[11px]">
                <thead className="sticky top-0" style={{ backgroundColor: PANEL2 }}>
                  <tr className="border-b" style={{ borderColor: BORDER }}>
                    <th className="px-2 py-1 text-[#6b7280]">Wallet</th>
                    <th className="px-2 py-1 text-right text-[#6b7280]">Balance</th>
                    <th className="px-2 py-1 text-right text-[#6b7280]">Holdings</th>
                    <th className="px-2 py-1 text-right text-[#6b7280]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {walletRows.map((w, i) => (
                    <tr
                      key={w.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', w.id)}
                      className="cursor-grab border-b active:cursor-grabbing"
                      style={{ borderColor: BORDER, backgroundColor: i % 2 === 0 ? '#080d14' : '#151826' }}
                    >
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <GripVertical className="h-3.5 w-3.5 text-[#4b5563]" />
                          <div>
                            <div className="font-medium text-white">{w.label?.trim() || shortenAddress(w.wallet_address, 4)}</div>
                            <div className="tabular-nums text-[10px] text-[#6b7280]">{shortenAddress(w.wallet_address, 5)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-[#5eead4]">{w.balance_lamports ? formatNumber(lamportsToSol(BigInt(w.balance_lamports)), { decimals: 3 }) : '0'}</td>
                      <td className="px-2 py-1.5 text-right text-[#6b7280]">0</td>
                      <td className="px-2 py-1.5 text-right text-[#6b7280]"><button className="rounded p-1 hover:bg-white/5"><ExternalLink className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  ))}
                  {walletRows.length === 0 ? <tr><td colSpan={4} className="px-2 py-10 text-center text-[#6b7280]">No wallets</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
          <section className="col-span-12 flex min-h-0 flex-col rounded border md:col-span-6" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
            <div className="flex items-center justify-between border-b px-2 py-1 text-[11px]" style={{ borderColor: BORDER }}>
              <span className="font-semibold text-[#9ca3af]">Transfer Builder</span>
              <span className="tabular-nums text-[10px] text-[#6b7280]">
                {sourceWallets.length} source • {destinationWallet ? '1 destination' : 'no destination'}
              </span>
            </div>
            <div className="grid min-h-0 flex-1 grid-rows-2 gap-1.5 p-1.5">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain');
                  if (id) onDropSource(id);
                }}
                className="flex min-h-0 flex-col rounded border border-dashed"
                style={{ borderColor: BORDER, backgroundColor: '#080d14' }}
              >
                <div className="flex items-center justify-between border-b px-2 py-1" style={{ borderColor: BORDER }}>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">Send From</span>
                  <span className="tabular-nums text-[10px] text-[#5eead4]">
                    {formatNumber(sourceWallets.reduce((sum, w) => sum + (w.balance_lamports ? lamportsToSol(BigInt(w.balance_lamports)) : 0), 0), { decimals: 4 })}
                  </span>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  {sourceWallets.length === 0 ? (
                    <div className="flex h-full min-h-[120px] items-center justify-center text-center text-[#4b5563]">
                      <div>
                        <GripVertical className="mx-auto h-5 w-5" />
                        <p className="mt-1 text-[11px]">Drag wallets here to send TON</p>
                      </div>
                    </div>
                  ) : (
                    sourceWallets.map((w) => (
                      <div key={w.id} className="flex items-center justify-between border-b px-2 py-1.5 last:border-b-0" style={{ borderColor: BORDER }}>
                        <div>
                          <div className="text-[11px] font-semibold text-white">{w.label?.trim() || shortenAddress(w.wallet_address, 4)}</div>
                          <div className="tabular-nums text-[10px] text-[#6b7280]">{shortenAddress(w.wallet_address, 5)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums text-[10px] text-[#5eead4]">{w.balance_lamports ? formatNumber(lamportsToSol(BigInt(w.balance_lamports)), { decimals: 4 }) : '0'}</span>
                          <button
                            type="button"
                            onClick={() => setSourceWalletIds((current) => current.filter((id) => id !== w.id))}
                            className="rounded px-1 text-[10px] text-[#6b7280] hover:bg-white/5 hover:text-white"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData('text/plain');
                  if (id) onDropDestination(id);
                }}
                className="flex min-h-0 flex-col rounded border border-dashed"
                style={{ borderColor: BORDER, backgroundColor: '#080d14' }}
              >
                <div className="flex items-center justify-between border-b px-2 py-1" style={{ borderColor: BORDER }}>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9ca3af]">Receive To</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (sourceWallets.length > 0 && destinationWallet) setTransferOpen(true);
                    }}
                    className="rounded bg-[#5865F2] px-2 py-1 text-[10px] font-semibold text-[#0a0a0f] disabled:opacity-40"
                    disabled={sourceWallets.length === 0 || !destinationWallet}
                  >
                    Start Consolidation
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  {!destinationWallet ? (
                    <div className="flex h-full min-h-[120px] items-center justify-center text-center text-[#4b5563]">
                      <div>
                        <GripVertical className="mx-auto h-5 w-5" />
                        <p className="mt-1 text-[11px]">Drag one wallet here to receive TON</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <div>
                        <div className="text-[11px] font-semibold text-white">{destinationWallet.label?.trim() || shortenAddress(destinationWallet.wallet_address, 4)}</div>
                        <div className="tabular-nums text-[10px] text-[#6b7280]">{shortenAddress(destinationWallet.wallet_address, 5)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums text-[10px] text-[#5eead4]">{destinationWallet.balance_lamports ? formatNumber(lamportsToSol(BigInt(destinationWallet.balance_lamports)), { decimals: 4 }) : '0'}</span>
                        <button
                          type="button"
                          onClick={() => setDestinationWalletId(null)}
                          className="rounded px-1 text-[10px] text-[#6b7280] hover:bg-white/5 hover:text-white"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <div className="flex shrink-0 items-center justify-between border-t px-2 py-1 text-[10px]" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-2">
          <span className="text-[#6b7280]">BTC</span>
          <span className="tabular-nums text-white">{btc?.usdPrice != null ? `$${formatNumber(btc.usdPrice, { decimals: 2 })}` : '—'}</span>
          <span className={cn('tabular-nums', (btc?.priceChange24h ?? 0) >= 0 ? 'text-[#34d399]' : 'text-[#fb7185]')}>
            {btc?.priceChange24h != null ? `${btc.priceChange24h >= 0 ? '+' : ''}${formatNumber(btc.priceChange24h, { decimals: 2 })}%` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[#6b7280]">
          <span>Vol {formatNumber(trades.length * 1.3, { decimals: 1, compact: true })}</span>
          <span>TX {trades.length}</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-1.5 py-px text-emerald-300"><Check className="h-3 w-3" /> Stable</span>
          <span>US-E</span>
        </div>
      </div>

      <ImportWalletModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={persistImportedPointerRow}
      />

      {transferOpen && sourceWallets[0] && destinationWallet ? (
        <TransferModal
          source={sourceWallets[0]}
          destination={destinationWallet}
          amount={transferAmount}
          onAmountChange={setTransferAmount}
          onClose={() => setTransferOpen(false)}
          onSubmit={() => {
            toast.info('Transfer execution is not live yet');
            setTransferOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function TransferModal({
  source,
  destination,
  amount,
  onAmountChange,
  onClose,
  onSubmit,
}: {
  source: MyWalletRow;
  destination: MyWalletRow;
  amount: string;
  onAmountChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const available = source.balance_lamports ? lamportsToSol(BigInt(source.balance_lamports)) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-[360px] rounded border bg-[#17191f] shadow-2xl" style={{ borderColor: BORDER }}>
        <div className="flex items-center justify-between border-b px-3 py-3" style={{ borderColor: BORDER }}>
          <h2 className="text-[13px] font-semibold text-white">
            Transfer from {source.label?.trim() || 'wallet'} to {destination.label?.trim() || 'wallet'}
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-[#9ca3af] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded border px-3 py-2 text-[11px] font-semibold text-[#d1d5db]"
            style={{ borderColor: BORDER, backgroundColor: '#11141b' }}
          >
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-[#5865F2]" />
              TON
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-[#6b7280]" />
          </button>

          <div>
            <label className="mb-1 block text-[11px] font-medium text-[#8b93a3]">Amount</label>
            <div className="flex gap-2">
              <div className="flex min-w-0 flex-1 items-center rounded border px-2" style={{ borderColor: BORDER, backgroundColor: '#11141b' }}>
                <input
                  value={amount}
                  onChange={(e) => onAmountChange(e.target.value)}
                  placeholder="Enter amount"
                  inputMode="decimal"
                  className="min-w-0 flex-1 border-0 bg-transparent py-2 text-[12px] text-white outline-none placeholder:text-[#4b5563]"
                />
                <span className="h-3 w-3 rounded-sm bg-[#5865F2]" />
              </div>
              <div className="flex w-14 items-center justify-center rounded border text-[11px] text-[#8b93a3]" style={{ borderColor: BORDER, backgroundColor: '#11141b' }}>
                0.0 %
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="relative h-1 rounded-full bg-[#2a2f3a]">
              <div className="absolute left-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[#5865F2]" />
            </div>
            <div className="flex justify-between text-[10px] text-[#8b93a3]">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="text-[11px] text-[#8b93a3]">
            Available: <span className="tabular-nums text-[#d1d5db]">{formatNumber(available, { decimals: 5 })}</span>
          </div>
        </div>
        <div className="border-t p-3" style={{ borderColor: BORDER }}>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!amount.trim()}
            className="w-full rounded-full bg-[#5865F2] py-2 text-[12px] font-semibold text-[#05070d] disabled:opacity-45"
          >
            Start Transfer
          </button>
        </div>
      </div>
    </div>
  );
}

function TinyLineChart({ positive = true }: { positive?: boolean }) {
  return (
    <div className="relative h-[86px] w-full overflow-hidden rounded border" style={{ borderColor: BORDER }}>
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
      <div className="absolute inset-0 grid grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-r last:border-r-0" style={{ borderColor: BORDER }} />
        ))}
      </div>
      <div className="absolute inset-0 grid grid-rows-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-b last:border-b-0" style={{ borderColor: BORDER }} />
        ))}
      </div>
      <div className="absolute left-0 right-0 top-1/2 h-px" style={{ backgroundColor: positive ? '#10b981' : '#fb7185' }} />
    </div>
  );
}

function PortfolioPlaceholderRows() {
  return (
    <>
      {Array.from({ length: 9 }).map((_, i) => (
        <tr key={i} className="border-b" style={{ borderColor: BORDER, backgroundColor: i % 2 === 0 ? '#080d14' : '#151826' }}>
          <td className="px-2 py-1">
            <div className="flex items-center gap-1.5">
              <span className="h-4 w-4 rounded bg-[#20263a]/70" />
              <span className="h-2 w-20 rounded bg-white/[0.06]" />
            </div>
          </td>
          <td className="px-2 py-1 text-right"><span className="ml-auto block h-2 w-14 rounded bg-white/[0.05]" /></td>
          <td className="px-2 py-1 text-right"><span className="ml-auto block h-2 w-14 rounded bg-white/[0.05]" /></td>
          <td className="px-2 py-1 text-right"><span className="ml-auto block h-2 w-12 rounded bg-white/[0.05]" /></td>
          <td className="px-2 py-1 text-right"><span className="ml-auto block h-2 w-8 rounded bg-white/[0.05]" /></td>
        </tr>
      ))}
      <tr>
        <td colSpan={5} className="px-2 py-2 text-center text-[10px] text-[#4b5563]">
          No active portfolio rows yet. New fills will populate this table.
        </td>
      </tr>
    </>
  );
}

function PerfRow({ label, value, bar }: { label: string; value: string; bar?: number }) {
  return (
    <div className="space-y-[2px]">
      <div className="flex items-center justify-between text-[10px] text-[#9ca3af]">
        <span>{label}</span>
        <span className="tabular-nums text-white">{value}</span>
      </div>
      {bar != null ? (
        <div className="h-[3px] rounded-full bg-[#080d14]">
          <div className="h-full rounded-full bg-[#5865F2]" style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} />
        </div>
      ) : null}
    </div>
  );
}
