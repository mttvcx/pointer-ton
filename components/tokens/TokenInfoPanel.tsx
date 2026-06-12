'use client';

import { AlertTriangle } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatNumber } from '@/lib/utils/formatters';
import { EMPTY_TOKEN_EXTENDED_METRICS } from '@/lib/dev/demoPolicy';
import { syntheticTokenExtendedMetrics } from '@/lib/dev/demoTokenFixtures';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';
import { isQaDeskLiveModeClient } from '@/lib/qa/qaDeskLiveModeClient';
import type { TokenExtendedMetrics } from '@/lib/types/tokenExtendedMetrics';
import { tokenMetricValueClass } from '@/lib/tokens/tokenInfoMetricColors';
import { DESK_FIELD_TOOLTIPS } from '@/lib/tokens/deskFieldTooltips';
import { TokenInfoTaxBanner, hasTokenTax } from '@/components/tokens/TokenInfoTaxBanner';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';

function pctOrDash(n: number | null | undefined): { text: string; missing: boolean } {
  if (n == null || !Number.isFinite(n)) return { text: '\u2014', missing: true };
  const v = Math.min(100, Math.max(0, n));
  return { text: `${formatNumber(v, { decimals: 2 })}%`, missing: false };
}

const METRIC_TOOLTIPS: Partial<Record<string, string>> = {
  'Snipers H.': DESK_FIELD_TOOLTIPS.snipers,
  Bundlers: DESK_FIELD_TOOLTIPS.bundlers,
  Insiders: DESK_FIELD_TOOLTIPS.insiders,
  'LP Burned': DESK_FIELD_TOOLTIPS.lpBurned,
  'Dex Paid': DESK_FIELD_TOOLTIPS.dexPaid,
};

function MetricValue({
  label,
  value,
  valueClass,
  missing,
}: {
  label: string;
  value: ReactNode;
  valueClass: string;
  missing?: boolean;
}) {
  const tip = METRIC_TOOLTIPS[label];
  if (!missing || !tip) {
    return <div className={cn(valueClass, label !== 'Dex Paid' && 'truncate')}>{value}</div>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(valueClass, 'cursor-help truncate border-b border-dotted border-fg-muted/30')}>
          {value}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-[10px] leading-snug">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

function TokenInfoMetricGrid({
  m,
  loading,
}: {
  m: TokenExtendedMetrics;
  loading?: boolean;
}) {
  const cells: {
    label: string;
    value: ReactNode;
    valueClass: string;
    missing?: boolean;
  }[] = [
    {
      label: 'Top 10 H.',
      ...(() => {
        const p = loading ? { text: '\u2026', missing: false } : pctOrDash(m.top10HolderPct);
        return {
          value: p.text,
          valueClass: tokenMetricValueClass('top10', m.top10HolderPct),
          missing: p.missing,
        };
      })(),
    },
    {
      label: 'Dev H.',
      ...(() => {
        const p = loading ? { text: '\u2026', missing: false } : pctOrDash(m.devHoldingPct);
        return {
          value: p.text,
          valueClass: tokenMetricValueClass('devh', m.devHoldingPct),
          missing: p.missing,
        };
      })(),
    },
    {
      label: 'Snipers H.',
      ...(() => {
        const p = loading ? { text: '\u2026', missing: false } : pctOrDash(m.sniperHolderPct);
        return {
          value: p.text,
          valueClass: tokenMetricValueClass('sniper', m.sniperHolderPct),
          missing: p.missing,
        };
      })(),
    },
    {
      label: 'Insiders',
      ...(() => {
        const p = loading ? { text: '\u2026', missing: false } : pctOrDash(m.insidersPct);
        return {
          value: p.text,
          valueClass: tokenMetricValueClass('insider', m.insidersPct),
          missing: p.missing,
        };
      })(),
    },
    {
      label: 'Bundlers',
      ...(() => {
        const p = loading ? { text: '\u2026', missing: false } : pctOrDash(m.bundlersPct);
        return {
          value: p.text,
          valueClass: tokenMetricValueClass('bundler', m.bundlersPct),
          missing: p.missing,
        };
      })(),
    },
    {
      label: 'LP Burned',
      ...(() => {
        const p = loading ? { text: '\u2026', missing: false } : pctOrDash(m.lpBurnedPct);
        return {
          value: p.text,
          valueClass: tokenMetricValueClass('lp', m.lpBurnedPct),
          missing: p.missing,
        };
      })(),
    },
    {
      label: 'Holders',
      value: loading
        ? '\u2026'
        : m.holders != null
          ? formatNumber(m.holders, { decimals: 0 })
          : '\u2014',
      valueClass: tokenMetricValueClass('holders', m.holders),
      missing: !loading && m.holders == null,
    },
    {
      label: 'Pro Traders',
      value: loading
        ? '\u2026'
        : m.proTraders != null
          ? formatNumber(m.proTraders, { decimals: 0 })
          : '\u2014',
      valueClass: tokenMetricValueClass('pro', m.proTraders),
      missing: !loading && m.proTraders == null,
    },
    {
      label: 'Dex Paid',
      /** `null` = paid status not ingested — render `—`, never assert Unpaid. */
      value:
        m.dexPaid == null ? (
          '\u2014'
        ) : m.dexPaid === false ? (
          <span className="inline-flex items-center justify-center gap-0.5">
            <AlertTriangle className="inline h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
            Unpaid
          </span>
        ) : (
          'Paid'
        ),
      valueClass: tokenMetricValueClass('dex', null, m.dexPaid),
      missing: m.dexPaid == null,
    },
  ];

  return (
    <>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-fg-muted">Token Info</h3>
      <div className="overflow-hidden rounded-lg border border-border-subtle/50 bg-transparent">
        {hasTokenTax(m.taxPct) ? <TokenInfoTaxBanner taxPct={m.taxPct} /> : null}
        <div className="grid grid-cols-3 gap-1.5 p-1">
          {cells.map((item) => (
            <div
              key={item.label}
              className={cn(
                'flex flex-col items-center justify-center rounded-md border border-border-subtle/50 bg-transparent px-1 py-2',
              )}
            >
              <MetricValue
                label={item.label}
                value={item.value}
                valueClass={item.valueClass}
                missing={item.missing}
              />
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-fg-muted">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function TokenInfoPanel({ mint, compactGrid }: { mint: string; compactGrid?: boolean }) {
  const uiDemo = useUiDemoMode();
  const qaLive = isQaDeskLiveModeClient(mint);
  const demoPayload = useMemo(
    () => ({ metrics: syntheticTokenExtendedMetrics(mint), symbol: null as string | null }),
    [mint],
  );

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
    placeholderData: uiDemo && !qaLive ? demoPayload : undefined,
    staleTime: 45_000,
  });

  const m = q.data?.metrics ?? (uiDemo && !qaLive ? demoPayload.metrics : EMPTY_TOKEN_EXTENDED_METRICS);
  const metricsLoading = q.isLoading && !q.data;

  if (compactGrid) {
    return (
      <div className="w-full min-w-0 p-2">
        <TokenInfoMetricGrid m={m} loading={metricsLoading} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[200px] w-full min-w-0 flex-col gap-2 bg-bg-raised p-2">
      <TokenInfoMetricGrid m={m} loading={metricsLoading} />
    </div>
  );
}
