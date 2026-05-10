'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { WalletAnalyticsHeader } from '@/components/wallet/analytics/WalletAnalyticsHeader';
import { WalletBalancePanel } from '@/components/wallet/analytics/WalletBalancePanel';
import { WalletPerformancePanel } from '@/components/wallet/analytics/WalletPerformancePanel';
import { WalletPnlChart } from '@/components/wallet/analytics/WalletPnlChart';
import { WalletPositionsTable } from '@/components/wallet/analytics/WalletPositionsTable';
import type { WalletAnalyticsPayload } from '@/lib/wallet-analytics/types';
import type { WalletAnalyticsTimeframe } from '@/lib/wallet-analytics/types';
import type { WalletPositionRow } from '@/lib/wallet-analytics/types';
import type { PnlSharePayload } from '@/lib/share/types';
import { cn } from '@/lib/utils/cn';
import { useWalletIntelStore } from '@/store/walletIntelStore';
import { useWalletLabelsStore } from '@/store/walletLabels';

type AnalyticsResponse = {
  timeframe: WalletAnalyticsTimeframe;
  data: WalletAnalyticsPayload;
};

const TABS = [
  'Active Positions',
  'History',
  'Top 100',
  'Activity',
  'Transfers',
] as const;

export function WalletAnalyticsModal() {
  const open = useWalletIntelStore((s) => s.walletOpen);
  const wallet = useWalletIntelStore((s) => s.wallet);
  const closeWallet = useWalletIntelStore((s) => s.closeWallet);
  const openShare = useWalletIntelStore((s) => s.openShare);

  const byLabel = useWalletLabelsStore((s) => s.byAddress);

  const [tf, setTf] = useState<WalletAnalyticsTimeframe>('30d');
  const [tab, setTab] = useState<(typeof TABS)[number]>('Active Positions');
  const [labelDraft, setLabelDraft] = useState('');

  useEffect(() => {
    if (!wallet?.address) return;
    const existing = byLabel[wallet.address]?.label;
    setLabelDraft(existing ?? '');
  }, [wallet?.address, byLabel]);

  const q = useQuery({
    queryKey: ['wallet-analytics', wallet?.address, tf],
    enabled: Boolean(open && wallet?.address),
    queryFn: async (): Promise<AnalyticsResponse> => {
      const res = await fetch(
        `/api/wallet/${encodeURIComponent(wallet!.address)}/analytics?tf=${encodeURIComponent(tf)}`,
      );
      if (!res.ok) throw new Error('wallet_analytics_failed');
      return res.json() as Promise<AnalyticsResponse>;
    },
  });

  const data = q.data?.data;

  const shareFromRow = (row: WalletPositionRow) => {
    if (!wallet) return;
    const trimmed = labelDraft.trim();
    const payload: PnlSharePayload = {
      walletAddress: wallet.address,
      walletLabel: trimmed || null,
      tokenMint: row.mint,
      tokenTicker: row.symbol,
      tokenName: row.name,
      tokenIconUrl: row.imageUrl,
      chain: wallet.chain,
      timeframe: tf,
      pnlUsd: row.pnlUsd,
      pnlPct: row.pnlPct,
      investedUsd: null,
      positionUsd: row.remainingUsd,
      realizedUsd: null,
      unrealizedUsd: null,
    };
    openShare(payload);
  };

  if (!open || !wallet) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex animate-in fade-in items-center justify-center p-3 duration-200 sm:p-6"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        aria-label="Close wallet analytics"
        onClick={() => closeWallet()}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex max-h-[min(92vh,920px)] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-white/[0.09]',
          'bg-[rgba(6,10,16,0.94)] shadow-[0_40px_120px_-36px_rgba(0,0,0,0.95)] backdrop-blur-xl',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-h-[min(92vh,920px)] overflow-y-auto px-4 py-5 sm:px-6">
          <WalletAnalyticsHeader
            address={wallet.address}
            chain={wallet.chain}
            labelDraft={labelDraft}
            onLabelChange={setLabelDraft}
            timeframe={tf}
            onTimeframe={(next) => setTf(next)}
            onClose={() => closeWallet()}
          />

          {q.isLoading ? (
            <div className="flex items-center justify-center py-24 text-fg-muted">
              <Loader2 className="h-6 w-6 animate-spin" strokeWidth={2} />
            </div>
          ) : q.isError || !data ? (
            <p className="py-16 text-center text-[13px] text-signal-bear">
              Could not load wallet intelligence. Try again shortly.
            </p>
          ) : (
            <>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <WalletBalancePanel data={data} currency="USD" />
                <div className="flex min-h-[220px] flex-col rounded-xl border border-border-subtle/80 bg-bg-base/40 p-4 lg:col-span-1">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
                    PNL
                  </h3>
                  <WalletPnlChart points={data.chart} className="mt-3 min-h-[180px] flex-1" />
                </div>
                <WalletPerformancePanel data={data} timeframe={tf} />
              </div>

              <div className="mt-6 border-b border-border-subtle/70">
                <div className="flex gap-1 overflow-x-auto pb-px">
                  {TABS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTab(t)}
                      className={cn(
                        'whitespace-nowrap rounded-t-lg px-3 py-2 text-[11px] font-semibold transition',
                        tab === t
                          ? 'bg-bg-hover text-accent-primary ring-1 ring-border-subtle'
                          : 'text-fg-muted hover:text-fg-secondary',
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                {tab === 'Active Positions' ? (
                  <WalletPositionsTable
                    rows={data.positions}
                    timeframe={tf}
                    onShareRow={shareFromRow}
                  />
                ) : (
                  <div className="rounded-xl border border-border-subtle/60 bg-bg-base/30 px-4 py-12 text-center text-[13px] text-fg-muted">
                    {tab} feed is coming online — pinned wallet intelligence stays on Positions for now.
                  </div>
                )}
              </div>

              {data.statsComputedAt ? (
                <p className="mt-6 text-[10px] text-fg-muted">
                  Indexed stats refreshed from telemetry when available — chart illustrates the selected
                  window.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
