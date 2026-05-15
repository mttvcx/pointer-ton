'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpDown, Users } from 'lucide-react';
import { CopyButton } from '@/components/shared/CopyButton';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableRowSkeleton } from '@/components/shared/Skeleton';
import { useEntityHover } from '@/lib/hooks/useEntityHover';
import { syntheticHoldersResponse } from '@/lib/dev/demoTokenFixtures';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';
import { formatPercent, rawToUi } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import type { TraderDeskFilter } from '@/lib/walletIdentity/traderFilters';
import { holderRowMatchesFilter, TRADER_FILTER_OPTIONS } from '@/lib/walletIdentity/traderFilters';
import { WalletIdentityAnchor } from '@/components/wallet/identity/WalletIdentityAnchor';
import { useTrackedWalletsLookup } from '@/lib/hooks/useTrackedWalletsLookup';
import { useWalletLabels } from '@/lib/hooks/useWalletLabels';
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

export function HoldersTable({
  mint,
  creatorWallet = null,
  tokenSymbol,
}: {
  mint: string;
  creatorWallet?: string | null;
  tokenSymbol?: string | null;
}) {
  const uiDemo = useUiDemoMode();
  const [holderDeskFilter, setHolderDeskFilter] = useState<TraderDeskFilter>('all');
  const { isTracked } = useTrackedWalletsLookup();
  const { resolveLabel } = useWalletLabels();
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

  const sym = tokenSymbol ?? 'TOK';

  const visibleRows =
    filled?.holders.filter((h) =>
      holderDeskFilter === 'all'
        ? true
        : holderRowMatchesFilter({
            row: h,
            creatorWallet,
            tracked: isTracked(h.wallet_address),
            labelDisp: resolveLabel(h.wallet_address, 5),
            filter: holderDeskFilter,
          }),
    ) ?? [];

  const filteredEmpty = !!filled?.holders?.length && visibleRows.length === 0 && holderDeskFilter !== 'all';

  return (
    <section className="font-sans">
      <div className="flex items-center gap-2 px-3 py-2">
        <h2 className="text-[10px] font-medium uppercase tracking-wider text-fg-muted">TOP HOLDERS</h2>
        {filled ? (
          <span className="ml-auto text-xs text-fg-muted tabular-nums">
            {holderDeskFilter !== 'all' ? `${visibleRows.length}/` : null}
            {filled.holders.length}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <table className="w-full border-collapse text-left text-xs">
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
          description="Snapshots refresh shortly; try again if the mint just went live."
        />
      ) : filled && filled.holders.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No holders indexed yet"
          description="Holders appear after the pool has recognizable distribution."
        />
      ) : filteredEmpty ? (
        <EmptyState
          icon={Users}
          title="No holders match filters"
          description="Clear pills or widen the lens."
        />
      ) : filled ? (
        <>
          <div className="flex flex-wrap items-center gap-1 border-b border-border-subtle px-3 pb-2">
            {TRADER_FILTER_OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setHolderDeskFilter(id)}
                className={cn(
                  'btn-press inline-flex h-6 items-center rounded border px-2 text-[10px] font-medium uppercase tracking-wide transition-colors',
                  holderDeskFilter === id
                    ? 'border-border bg-bg-hover text-fg-primary'
                    : 'border-border-subtle bg-transparent text-fg-muted hover:bg-bg-hover',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-0 border-collapse text-left tabular-nums">
              <thead className="sticky top-0 z-[1] border-b border-border-subtle bg-bg-sunken text-[10px] font-medium uppercase tracking-wider text-fg-muted">
                <tr>
                  <HoldersTh className="w-10" align="left" showSortGlyph={false}>
                    #
                  </HoldersTh>
                  <HoldersTh className="min-w-[180px]" align="left">
                    Wallet
                  </HoldersTh>
                  <HoldersTh className="w-[100px]" align="right">
                    % supply
                  </HoldersTh>
                  <HoldersTh className="w-[100px]" align="right">
                    Balance
                  </HoldersTh>
                  <HoldersTh className="w-[90px]" align="left" showSortGlyph={false}>
                    Flags
                  </HoldersTh>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((h) => (
                  <HolderRowView
                    key={h.id}
                    row={h}
                    decimals={filled.decimals}
                    mint={mint}
                    creatorWallet={creatorWallet}
                    tokenSym={sym}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

function HoldersTh({
  children,
  className,
  align = 'left',
  showSortGlyph = true,
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right';
  showSortGlyph?: boolean;
}) {
  return (
    <th
      className={cn(
        'group/th px-3 py-2 align-middle leading-tight',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      <span
        className={cn(
          'inline-flex items-center gap-1',
          align === 'right' ? 'justify-end' : 'justify-start',
        )}
      >
        <span>{children}</span>
        {showSortGlyph ? (
          <ArrowUpDown
            className="h-3 w-3 shrink-0 text-fg-muted opacity-0 transition-opacity duration-100 group-hover/th:opacity-100"
            strokeWidth={2}
            aria-hidden
          />
        ) : null}
      </span>
    </th>
  );
}

function HolderRowView({
  row,
  decimals,
  mint,
  creatorWallet,
  tokenSym,
}: {
  row: HolderRow;
  decimals: number;
  mint: string;
  creatorWallet: string | null;
  tokenSym: string;
}) {
  const hoverProps = useEntityHover(
    useMemo(
      () => ({ type: 'wallet' as const, id: row.wallet_address }),
      [row.wallet_address],
    ),
  );

  const balanceUi = formatUiAmount(row.amount_raw, decimals);

  return (
    <tr
      className={cn(
        'group h-11 cursor-pointer border-b border-border-subtle bg-bg-raised transition-colors duration-100',
        'hover:bg-bg-hover last:border-b-0',
      )}
      {...hoverProps}
    >
      <td className="px-3 align-middle font-mono text-xs tabular-nums text-fg-muted">
        {row.rank ?? '\u2014'}
      </td>
      <td className="min-w-[180px] px-3 align-middle" title={row.wallet_address}>
        <span className="inline-flex items-center gap-1.5">
          <WalletIdentityAnchor
            address={row.wallet_address}
            mint={mint}
            tokenSymbol={tokenSym}
            creatorWallet={creatorWallet}
            href={`/wallet/${encodeURIComponent(row.wallet_address)}`}
            preferIntelModal
            truncate={5}
            isDev={!!row.is_dev}
            isSniper={!!row.is_sniper}
            className="text-xs text-fg-secondary hover:text-accent-primary"
          />
          <CopyButton
            value={row.wallet_address}
            iconOnly
            label="Copy holder address"
            toastLabel="Wallet address copied"
            iconClassName="text-fg-muted opacity-0 transition-opacity duration-100 hover:text-fg-primary group-hover:opacity-100 [&_svg]:h-3.5 [&_svg]:w-3.5"
          />
        </span>
      </td>
      <td
        className={cn(
          'px-3 text-right align-middle font-mono text-xs tabular-nums',
          row.pct_of_supply != null ? 'text-fg-primary' : 'text-fg-muted',
        )}
      >
        {row.pct_of_supply != null ? formatPercent(row.pct_of_supply) : '\u2014'}
      </td>
      <td
        className={cn(
          'px-3 text-right align-middle font-mono text-xs tabular-nums',
          balanceUi !== '\u2014' ? 'text-fg-primary' : 'text-fg-muted',
        )}
      >
        {balanceUi}
      </td>
      <td className="px-3 align-middle">
        <span className="inline-flex flex-wrap items-center gap-1">
          {row.is_dev ? <FlagTag tone="dev">DEV</FlagTag> : null}
          {row.is_sniper ? <FlagTag tone="sniper">SNIPER</FlagTag> : null}
        </span>
      </td>
    </tr>
  );
}

function FlagTag({ children, tone }: { children: string; tone: 'dev' | 'sniper' }) {
  const palette =
    tone === 'dev'
      ? 'border-0 bg-fg-muted/15 text-fg-secondary'
      : 'border-0 bg-signal-bear/15 text-signal-bear';
  return (
    <span
      className={cn(
        'inline-flex h-4 items-center rounded px-1.5 text-[10px] font-medium uppercase leading-none tracking-wide',
        palette,
      )}
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
