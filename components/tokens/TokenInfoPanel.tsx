'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { formatNumber } from '@/lib/utils/formatters';
import type { TokenExtendedMetrics } from '@/lib/types/tokenExtendedMetrics';
import { cn } from '@/lib/utils/cn';

function StatBox({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className={cn('min-w-0 rounded border border-[#1b1f2a] bg-[#12151c] px-2 py-1.5')}>
      <div className="text-[9px] font-semibold uppercase tracking-wide text-[#6b7280]">{label}</div>
      <div className={cn('mt-0.5 text-[12px] font-semibold tabular-nums', valueClass ?? 'text-[#e5e7eb]')}>
        {value}
      </div>
    </div>
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
      <div className="flex h-full min-h-[120px] w-full min-w-0 flex-col bg-[#080d14] p-2">
        <div className="flex items-center gap-2 text-[10px] text-[#6b7280]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Metrics…
        </div>
      </div>
    );
  }

  const m = q.data?.metrics;
  if (!m || q.isError) {
    return (
      <div className="flex h-full min-h-[120px] w-full min-w-0 flex-col bg-[#080d14] p-2">
        <p className="text-[11px] text-[#fb923c]">Could not load token intel.</p>
      </div>
    );
  }

  const pct = (n: number | null) => (n != null ? `${formatNumber(n, { decimals: 2 })}%` : '—');
  const pnlTone = (n: number | null, warnHi = 50) =>
    n == null ? 'text-[#9ca3af]' : n > warnHi ? 'text-[#fb7185]' : 'text-[#34d399]';

  const grid = (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
      <StatBox label="Top 10 H." value={pct(m.top10HolderPct)} valueClass={pnlTone(m.top10HolderPct, 25)} />
      <StatBox
        label="Dev H."
        value={pct(m.devHoldingPct)}
        valueClass={m.devHoldingPct != null && m.devHoldingPct > 5 ? 'text-[#fb7185]' : 'text-[#34d399]'}
      />
      <StatBox label="Snipers H." value={pct(m.sniperHolderPct)} valueClass="text-[#34d399]" />
      <StatBox label="Insiders" value={pct(m.insidersPct)} valueClass={pnlTone(m.insidersPct, 20)} />
      <StatBox
        label="Bundlers"
        value={pct(m.bundlersPct)}
        valueClass={m.bundlersPct != null && m.bundlersPct > 100 ? 'text-[#fb7185]' : 'text-[#e5e7eb]'}
      />
      <StatBox
        label="LP Burned"
        value={pct(m.lpBurnedPct)}
        valueClass={m.lpBurnedPct != null && m.lpBurnedPct >= 99 ? 'text-[#34d399]' : 'text-[#e5e7eb]'}
      />
    </div>
  );

  const mini = (
    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-[#1b1f2a] pt-1.5 text-[10px] text-[#9ca3af]">
      <span>
        Holders: <span className="font-semibold tabular-nums text-[#e5e7eb]">{m.holders ?? '—'}</span>
      </span>
      <span>
        Pro Traders:{' '}
        <span className="font-semibold tabular-nums text-[#e5e7eb]">{m.proTraders ?? '—'}</span>
      </span>
      <span>
        Dex Paid:{' '}
        <span
          className={cn(
            'font-semibold',
            m.dexPaid === false ? 'text-[#fb7185]' : m.dexPaid === true ? 'text-[#34d399]' : 'text-[#e5e7eb]',
          )}
        >
          {m.dexPaid == null ? '—' : m.dexPaid ? 'Paid' : 'Unpaid'}
        </span>
      </span>
    </div>
  );

  if (compactGrid) {
    return (
      <div className="w-full min-w-0 bg-[#080d14] p-2">
        <div className="text-[9px] font-semibold uppercase tracking-[0.02em] text-[#6b7280]">Token intel</div>
        <div className="mt-1">{grid}</div>
        {mini}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[200px] w-full min-w-0 flex-col gap-2 bg-[#080d14] p-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.02em] text-[#6b7280]">Token intel</h3>
      {grid}
      {mini}
      <div className="space-y-1 text-[10px] text-[#6b7280]">
        <div className="font-semibold uppercase tracking-wide">6h tape</div>
        <div className="flex justify-between gap-2">
          <span>Vol $</span>
          <span className="tabular-nums tabular-nums text-[#e5e7eb]">
            {m.vol6hUsd != null ? `$${formatNumber(m.vol6hUsd, { decimals: 0 })}` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
