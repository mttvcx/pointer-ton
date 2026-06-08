'use client';

import { useMemo } from 'react';
import { PnlShareCard } from '@/components/wallet/analytics/PnlShareCard';
import { monthlyPnlToSharePayload } from '@/lib/portfolio/monthlyPnlSharePayload';
import type { DayActivity, MonthPnlSummary } from '@/lib/portfolio/dailyPnlCalendar';
import type { PnlSharePayload } from '@/lib/share/types';
import { DEFAULT_SHARE_OVERLAY } from '@/lib/share/types';
import { useWalletIntelStore } from '@/store/walletIntelStore';

const MOCK_POSITION: PnlSharePayload = {
  walletAddress: 'DemoWalletPreview111111111111111111111111',
  walletLabel: 'pointer',
  tokenMint: 'demo-mint',
  tokenTicker: 'PEEPEE',
  tokenName: 'Dr. Peepee',
  tokenIconUrl: null,
  chain: 'sol',
  timeframe: '30d',
  pnlUsd: 84_732.5,
  pnlPct: 142.8,
  investedUsd: 12_500,
  positionUsd: 4_200,
  realizedUsd: 80_532.5,
  unrealizedUsd: 4_200,
};

function mockMonthSummary(): MonthPnlSummary {
  const daily = new Map<string, DayActivity>();
  const samples: [string, DayActivity][] = [
    ['2026-06-01', { pnlUsd: 820, pnlSol: 5.4, buys: 2, sells: 1, buyVolSol: 12, sellVolSol: 8 }],
    ['2026-06-03', { pnlUsd: -420, pnlSol: -2.8, buys: 1, sells: 2, buyVolSol: 6, sellVolSol: 9 }],
    ['2026-06-05', { pnlUsd: 2100, pnlSol: 14.1, buys: 3, sells: 1, buyVolSol: 18, sellVolSol: 11 }],
    ['2026-06-07', { pnlUsd: 640, pnlSol: 4.2, buys: 1, sells: 1, buyVolSol: 9, sellVolSol: 7 }],
    ['2026-06-09', { pnlUsd: 1280, pnlSol: 8.5, buys: 2, sells: 2, buyVolSol: 14, sellVolSol: 16 }],
    ['2026-06-11', { pnlUsd: -180, pnlSol: -1.2, buys: 1, sells: 1, buyVolSol: 5, sellVolSol: 4 }],
    ['2026-06-13', { pnlUsd: 3920, pnlSol: 26.2, buys: 4, sells: 2, buyVolSol: 22, sellVolSol: 19 }],
  ];
  for (const [k, v] of samples) daily.set(k, v);

  return {
    year: 2026,
    month: 5,
    totalPnlUsd: 8_160,
    totalPnlSol: 54.4,
    winDays: 5,
    lossDays: 2,
    winTotalUsd: 8_760,
    winTotalSol: 58.4,
    lossTotalUsd: -600,
    lossTotalSol: -4,
    daily,
    currentPositiveStreak: 1,
    bestPositiveStreak: 3,
  };
}

/**
 * Offline preview for the chrome PnL share card — no Supabase, Privy, or token page required.
 * Visit `/dev/pnl-share` while egress quota is blocked.
 */
export default function DevPnlSharePreviewPage() {
  const openShare = useWalletIntelStore((s) => s.openShare);
  const openMonthlyShare = useWalletIntelStore((s) => s.openMonthlyShare);

  const monthlyPayload = useMemo(
    () =>
      monthlyPnlToSharePayload({
        year: 2026,
        month: 5,
        summary: mockMonthSummary(),
        solUsd: 150,
        buyVolSol: 86,
        sellVolSol: 74,
        currency: 'usd',
      }),
    [],
  );

  return (
    <main className="mx-auto flex min-h-0 max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-fg-primary">PnL share preview</h1>
        <p className="max-w-2xl text-sm text-fg-muted">
          Local-only preview — works when Supabase egress is blocked and token pages fail. Use the
          buttons to open the full export composer (PNG / copy / video).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-border-subtle bg-bg-hover px-3 py-1.5 text-sm font-medium text-fg-primary hover:bg-bg-sunken"
          onClick={() => openShare(MOCK_POSITION)}
        >
          Open position composer
        </button>
        <button
          type="button"
          className="rounded-md border border-border-subtle bg-bg-hover px-3 py-1.5 text-sm font-medium text-fg-primary hover:bg-bg-sunken"
          onClick={() =>
            openMonthlyShare({
              year: 2026,
              month: 5,
              currency: 'usd',
              summary: mockMonthSummary(),
              solUsd: 150,
              buyVolSol: 86,
              sellVolSol: 74,
            })
          }
        >
          Open monthly composer
        </button>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Position card</h2>
        <div className="overflow-hidden">
          <PnlShareCard
            payload={MOCK_POSITION}
            overlay={DEFAULT_SHARE_OVERLAY}
            backgroundId="midnight"
            chainTicker="SOL"
            solUsd={150}
            shareKind="position"
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Monthly card</h2>
        <div className="overflow-hidden">
          <PnlShareCard
            payload={monthlyPayload}
            overlay={DEFAULT_SHARE_OVERLAY}
            backgroundId="midnight"
            chainTicker="USD"
            solUsd={150}
            shareKind="monthly"
            shareHeader="June 2026"
          />
        </div>
      </section>
    </main>
  );
}
