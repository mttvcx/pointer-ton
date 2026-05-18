'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatNumber } from '@/lib/utils/formatters';
import type { TokenExtendedMetrics } from '@/lib/types/tokenExtendedMetrics';
import { tokenMetricCellSurface, tokenMetricValueClass } from '@/lib/tokens/tokenInfoMetricColors';
import { cn } from '@/lib/utils/cn';

function TokenInfoMetricGrid({ m }: { m: TokenExtendedMetrics }) {
  const pct = (n: number | null | undefined) =>
    `${formatNumber(n ?? 0, { decimals: 2 })}%`;

  const dexLabel = m.dexPaid == null ? 'Unpaid' : m.dexPaid ? 'Paid' : 'Unpaid';
  const dexCls = tokenMetricValueClass('dex', 0, m.dexPaid);

  const cells: { label: string; value: ReactNode; valueClass: string }[] = [
    {
      label: 'Top 10 H.',
      value: pct(m.top10HolderPct),
      valueClass: tokenMetricValueClass('top10', m.top10HolderPct ?? 0),
    },
    {
      label: 'Dev H.',
      value: pct(m.devHoldingPct),
      valueClass: tokenMetricValueClass('devh', m.devHoldingPct ?? 0),
    },
    {
      label: 'Snipers H.',
      value: pct(m.sniperHolderPct),
      valueClass: tokenMetricValueClass('sniper', m.sniperHolderPct ?? 0),
    },
    {
      label: 'Insiders',
      value: pct(m.insidersPct),
      valueClass: tokenMetricValueClass('insider', m.insidersPct ?? 0),
    },
    {
      label: 'Bundlers',
      value: pct(m.bundlersPct),
      valueClass: tokenMetricValueClass('bundler', m.bundlersPct ?? 0),
    },
    {
      label: 'LP Burned',
      value: pct(m.lpBurnedPct),
      valueClass: tokenMetricValueClass('lp', m.lpBurnedPct ?? 0),
    },
    {
      label: 'Holders',
      value: formatNumber(m.holders ?? 0, { decimals: 0 }),
      valueClass: tokenMetricValueClass('holders', m.holders ?? 0),
    },
    {
      label: 'Pro Traders',
      value: formatNumber(m.proTraders ?? 0, { decimals: 0 }),
      valueClass: tokenMetricValueClass('pro', m.proTraders ?? 0),
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
            className={cn(
              'flex flex-col items-center justify-center px-1 py-2',
              tokenMetricCellSurface(item.valueClass),
            )}
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
