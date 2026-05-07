'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Users } from 'lucide-react';
import { CopyButton } from '@/components/shared/CopyButton';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableRowSkeleton } from '@/components/shared/Skeleton';
import { useEntityHover } from '@/lib/hooks/useEntityHover';
import { syntheticHoldersResponse } from '@/lib/dev/demoTokenFixtures';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';
import { formatPercent, rawToUi } from '@/lib/utils/formatters';
import { shortenAddress } from '@/lib/utils/addresses';

type HolderRow = {
  id: number;
  mint: string;
  wallet_address: string;
  amount_raw: string;
  pct_of_supply: number | null;
  is_dev: boolean | null;
  is_sniper: boolean | null;
  rank: number | null;
  computed_at: string;
};

type HoldersResponse = {
  mint: string;
  decimals: number;
  holders: HolderRow[];
};

export function HoldersTable({ mint }: { mint: string }) {
  const uiDemo = useUiDemoMode();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['token-holders', mint],
    queryFn: async (): Promise<HoldersResponse> => {
      const r = await fetch(`/api/tokens/${encodeURIComponent(mint)}/holders`);
      if (!r.ok) throw new Error('holders_failed');
      return r.json() as Promise<HoldersResponse>;
    },
  });

  const filled =
    !isLoading && uiDemo && (isError || !data || data.holders.length === 0)
      ? syntheticHoldersResponse(mint, data?.decimals ?? 9)
      : data;

  return (
      <section className="p-3 font-sans">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.02em] text-fg-muted">
          Top holders
        </h2>
        {filled ? (
          <span className="rounded border border-border-subtle bg-bg-base px-1.5 py-px text-[10px] tabular-nums text-fg-secondary">
            {filled.holders.length}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <table className="mt-3 w-full border-collapse text-left text-xs">
          <tbody>
            {Array.from({ length: 6 }, (_, i) => (
              <TableRowSkeleton key={i} cols={5} />
            ))}
          </tbody>
        </table>
      ) : !uiDemo && isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Could not load holders"
          description="Holder snapshots are written by webhook ingest. Try again in a moment."
        />
      ) : filled && filled.holders.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No holders indexed yet"
          description="Webhook ingest populates holder snapshots once the first trades hit Pulse."
        />
      ) : filled ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-[10px] uppercase tracking-wide text-fg-muted">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Wallet</th>
                <th className="py-2 pr-3 text-right font-medium">% supply</th>
                <th className="py-2 text-right font-medium">Balance</th>
                <th className="py-2 pl-2 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody className="text-fg-secondary">
              {filled.holders.map((h) => (
                <HolderRowView key={h.id} row={h} decimals={filled.decimals} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function HolderRowView({ row, decimals }: { row: HolderRow; decimals: number }) {
  const hoverProps = useEntityHover(
    useMemo(
      () => ({ type: 'wallet' as const, id: row.wallet_address }),
      [row.wallet_address],
    ),
  );

  return (
    <tr
      className="group border-b border-border-subtle/60 transition-colors duration-150 last:border-0 hover:bg-bg-hover/40"
      {...hoverProps}
    >
      <td className="py-2 pr-3 text-fg-muted">{row.rank ?? '\u2014'}</td>
      <td className="max-w-[220px] truncate py-2 pr-3 text-fg-primary" title={row.wallet_address}>
        <span className="inline-flex items-center gap-1">
          <Link
            href={`/wallet/${row.wallet_address}`}
            className="hover:text-accent-primary"
          >
            {shortenAddress(row.wallet_address, 5)}
          </Link>
          <CopyButton
            value={row.wallet_address}
            iconOnly
            label="Copy holder address"
            toastLabel="Wallet address copied"
            iconClassName="opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          />
        </span>
      </td>
      <td className="py-2 pr-3 text-right tabular-nums">
        {row.pct_of_supply != null ? formatPercent(row.pct_of_supply) : '\u2014'}
      </td>
      <td className="py-2 text-right tabular-nums text-fg-secondary">
        {formatUiAmount(row.amount_raw, decimals)}
      </td>
      <td className="py-2 pl-2">
        <span className="flex flex-wrap gap-1">
          {row.is_dev ? <Tag tone="warn">dev</Tag> : null}
          {row.is_sniper ? <Tag tone="bear">sniper</Tag> : null}
        </span>
      </td>
    </tr>
  );
}

function Tag({ children, tone }: { children: string; tone: 'warn' | 'bear' }) {
  const palette =
    tone === 'warn'
      ? 'border-amber-500/40 text-amber-100/85'
      : 'border-rose-500/40 text-rose-100/85';
  return (
    <span
      className={`rounded border bg-transparent px-1 py-px text-[8px] font-medium uppercase tracking-wider ${palette}`}
    >
      {children}
    </span>
  );
}

function formatUiAmount(raw: string, decimals: number): string {
  const ui = rawToUi(raw, decimals);
  if (!Number.isFinite(ui)) return '\u2014';
  if (ui >= 1_000_000) return `${(ui / 1_000_000).toFixed(2)}M`;
  if (ui >= 1_000) return `${(ui / 1_000).toFixed(2)}K`;
  if (ui >= 1) return ui.toFixed(2);
  return ui.toPrecision(4);
}
