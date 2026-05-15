'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatNumber } from '@/lib/utils/formatters';
import type { TokenExtendedMetrics } from '@/lib/types/tokenExtendedMetrics';
import { cn } from '@/lib/utils/cn';

function tokenInfoCellValueClass(
  kind:
    | 'top10'
    | 'devh'
    | 'sniper'
    | 'insider'
    | 'bundler'
    | 'lp'
    | 'holders'
    | 'pro'
    | 'dex',
  n: number | null | undefined,
  dexPaid?: boolean | null,
): string {
  if (kind === 'dex') {
    if (dexPaid === true) return 'text-signal-bull font-semibold text-xs';
    return 'text-signal-bear font-semibold text-xs';
  }
  const isZero = n == null || !Number.isFinite(n) || n === 0;
  if (kind === 'holders' || kind === 'pro') {
    return cn('text-sm font-semibold tabular-nums', isZero ? 'text-fg-muted' : 'text-fg-primary');
  }
  if (isZero) return 'text-sm font-semibold tabular-nums text-fg-muted';
  if (kind === 'top10' || kind === 'devh') return 'text-sm font-semibold tabular-nums text-fg-primary';
  if (kind === 'sniper' || kind === 'insider' || kind === 'bundler') {
    return 'text-sm font-semibold tabular-nums text-signal-bear';
  }
  return 'text-sm font-semibold tabular-nums text-signal-bull';
}

function TokenInfoMetricGrid({ m }: { m: TokenExtendedMetrics }) {
  const pct = (n: number | null | undefined) =>
    `${formatNumber(n ?? 0, { decimals: 2 })}%`;

  const dexLabel = m.dexPaid == null ? 'Unpaid' : m.dexPaid ? 'Paid' : 'Unpaid';
  const dexCls = tokenInfoCellValueClass('dex', 0, m.dexPaid);

  const cells: { label: string; value: ReactNode; valueClass: string }[] = [
    {
      label: 'Top 10 H.',
      value: pct(m.top10HolderPct),
      valueClass: tokenInfoCellValueClass('top10', m.top10HolderPct ?? 0),
    },
    {
      label: 'Dev H.',
      value: pct(m.devHoldingPct),
      valueClass: tokenInfoCellValueClass('devh', m.devHoldingPct ?? 0),
    },
    {
      label: 'Snipers H.',
      value: pct(m.sniperHolderPct),
      valueClass: tokenInfoCellValueClass('sniper', m.sniperHolderPct ?? 0),
    },
    {
      label: 'Insiders',
      value: pct(m.insidersPct),
      valueClass: tokenInfoCellValueClass('insider', m.insidersPct ?? 0),
    },
    {
      label: 'Bundlers',
      value: pct(m.bundlersPct),
      valueClass: tokenInfoCellValueClass('bundler', m.bundlersPct ?? 0),
    },
    {
      label: 'LP Burned',
      value: pct(m.lpBurnedPct),
      valueClass: tokenInfoCellValueClass('lp', m.lpBurnedPct ?? 0),
    },
    {
      label: 'Holders',
      value: formatNumber(m.holders ?? 0, { decimals: 0 }),
      valueClass: tokenInfoCellValueClass('holders', m.holders ?? 0),
    },
    {
      label: 'Pro Traders',
      value: formatNumber(m.proTraders ?? 0, { decimals: 0 }),
      valueClass: tokenInfoCellValueClass('pro', m.proTraders ?? 0),
    },
    {
      label: 'Dex Paid',
      value:
        m.dexPaid === false || m.dexPaid == null ? (
          <span className="inline-flex items-center justify-center gap-0.5">
            <AlertTriangle className="inline h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
            {dexLabel}
          </span>
        ) : (
          dexLabel
        ),
      valueClass: dexCls,
    },
  ];

  return (
    <>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-fg-muted">Token Info</h3>
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-border-subtle">
        {cells.map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center justify-center bg-bg-raised px-1 py-2"
          >
            <div className={cn(item.valueClass, item.label !== 'Dex Paid' && 'truncate')}>
              {item.value}
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-fg-muted">{item.label}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export function TokenInfoPanel({ mint, compactGrid }: { mint: string; compactGrid?: boolean }) {
  const q = useQuery({
    queryKey: ['token-extended-metrics', mint],
    queryFn: async (): Promise<{ metrics: TokenExtendedMetrics; symbol: string | null }> => {
      const res = await fetch(`/api/tokens/${encodeURIComponent(mint)}/extended-metrics`);
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg =
          typeof json === 'object' && json && 'error' in json
            ? String((json as { error: unknown }).error)
            : 'failed';
        throw new Error(msg);
      }
      return json as { metrics: TokenExtendedMetrics; symbol: string | null };
    },
    staleTime: 45_000,
  });

  if (q.isLoading && !q.data) {
    return (
      <div className="flex h-full min-h-[120px] w-full min-w-0 flex-col bg-bg-base p-2">
        <div className="flex items-center gap-2 text-[10px] text-fg-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Metrics…
        </div>
      </div>
    );
  }

  const m = q.data?.metrics;
  if (!m || q.isError) {
    return (
      <div className="flex h-full min-h-[120px] w-full min-w-0 flex-col bg-bg-base p-2">
        <p className="text-[11px] text-signal-warn">Could not load token intel.</p>
      </div>
    );
  }

  const footer = (
    <div className="mt-2 space-y-1 text-[10px] text-fg-muted">
      <div className="font-medium uppercase tracking-wider text-fg-muted">6h volume</div>
      <div className="flex justify-between gap-2 font-medium">
        <span>Vol $</span>
        <span className="tabular-nums text-fg-secondary">
          {m.vol6hUsd != null ? `$${formatNumber(m.vol6hUsd, { decimals: 0 })}` : '$0'}
        </span>
      </div>
    </div>
  );

  if (compactGrid) {
    return (
      <div className="w-full min-w-0 bg-bg-base p-2">
        <TokenInfoMetricGrid m={m} />
        {footer}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[200px] w-full min-w-0 flex-col gap-2 bg-bg-base p-2">
      <TokenInfoMetricGrid m={m} />
      {footer}
    </div>
  );
}
