'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowUpDown, Users } from 'lucide-react';
import { CopyButton } from '@/components/shared/CopyButton';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableRowSkeleton } from '@/components/shared/Skeleton';
import { useEntityHover } from '@/lib/hooks/useEntityHover';
import { syntheticHoldersResponse } from '@/lib/dev/demoTokenFixtures';
import { preferTokenTableDemoRows } from '@/lib/dev/uiDemoMode';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';
import {
  formatCompactUsd,
  formatNumber,
  formatPercent,
  rawToUi,
} from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import type { TraderDeskFilter } from '@/lib/walletIdentity/traderFilters';
import { holderRowMatchesFilter, TRADER_FILTER_OPTIONS } from '@/lib/walletIdentity/traderFilters';
import { WalletIdentityAnchor } from '@/components/wallet/identity/WalletIdentityAnchor';
import { useTrackedWalletsLookup } from '@/lib/hooks/useTrackedWalletsLookup';
import { useWalletLabels } from '@/lib/hooks/useWalletLabels';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { useUIStore } from '@/store/ui';
import { buildHolderDeskSynth } from '@/lib/tokens/holderDeskSynth';

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
  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);
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

  const filled = useMemo(() => {
    if (isLoading) return undefined;
    if (preferTokenTableDemoRows()) {
      return syntheticHoldersResponse(mint, data?.decimals ?? 9);
    }
    if (uiDemo && (isError || !data || data.holders.length === 0)) {
      return syntheticHoldersResponse(mint, data?.decimals ?? 9);
    }
    return data;
  }, [isLoading, mint, data, isError, uiDemo]);

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
    <section className="flex min-h-0 flex-1 flex-col font-sans text-[12px] leading-snug text-fg-primary">
      {isLoading ? (
        <table className="w-full border-collapse text-left text-xs">
          <tbody>
            {Array.from({ length: 8 }, (_, i) => (
              <TableRowSkeleton key={i} cols={11} />
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border-subtle/50 px-2 py-1.5">
            {TRADER_FILTER_OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setHolderDeskFilter(id)}
                className={cn(
                  'btn-press inline-flex h-7 items-center rounded px-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                  holderDeskFilter === id
                    ? 'bg-fg-primary/12 text-fg-primary'
                    : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
                )}
              >
                {label}
              </button>
            ))}
            {filled ? (
              <span className="ml-auto text-[11px] tabular-nums text-fg-muted">
                {holderDeskFilter !== 'all' ? `${visibleRows.length}/` : null}
                {filled.holders.length}
              </span>
            ) : null}
          </div>
          <div className="desk-scroll-well min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-y-auto rounded-b-[6px] border border-border-subtle/25 border-t-0 bg-bg-base/25 shadow-[inset_0_1px_0_rgb(var(--border-subtle-rgb)/0.45)] [scrollbar-gutter:stable] touch-pan-y [scrollbar-width:thin] [scrollbar-color:rgb(var(--border-strong-rgb)/0.65)_transparent]">
            <table className="w-full min-w-[1240px] border-collapse text-left tabular-nums">
              <thead className="sticky top-0 z-[2] border-b border-border-subtle/30 bg-bg-raised/96 backdrop-blur-md">
                <tr>
                  <HoldersTh className="w-9" showSortGlyph={false}>
                    #
                  </HoldersTh>
                  <HoldersTh className="min-w-[170px]" align="left">
                    Wallet
                  </HoldersTh>
                  <HoldersDualTh primary="SOL balance" secondary="(Last active)" align="right" />
                  <HoldersDualTh primary="Bought" secondary="Avg · qty · n" align="right" />
                  <HoldersDualTh primary="Sold" secondary="Avg · qty · n" align="right" />
                  <HoldersDualTh
                    primary="U. PnL"
                    secondary="Spot est."
                    align="right"
                    showSortGlyph
                  />
                  <HoldersDualTh primary="Remaining" secondary="Usd · %" align="right" />
                  <HoldersTh className="min-w-[128px]" align="right" showSortGlyph={false}>
                    Funding
                  </HoldersTh>
                  <HoldersTh align="right" showSortGlyph>
                    Held
                  </HoldersTh>
                  <HoldersTh align="left" showSortGlyph={false} className="w-[92px]">
                    Flags
                  </HoldersTh>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((h, i) => (
                  <HolderRowView
                    key={h.id}
                    rowIndex={i}
                    row={h}
                    decimals={filled.decimals}
                    mint={mint}
                    creatorWallet={creatorWallet}
                    tokenSym={sym}
                    nativeSym={nativeSym}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
        'group/th px-2.5 py-2 align-bottom text-[10px] font-semibold uppercase tracking-wide text-fg-muted leading-tight',
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

function HoldersDualTh({
  primary,
  secondary,
  align,
  showSortGlyph = false,
}: {
  primary: string;
  secondary: string;
  align: 'left' | 'right';
  showSortGlyph?: boolean;
}) {
  return (
    <th
      className={cn(
        'group/th px-2.5 py-2 align-bottom text-[11px] font-semibold leading-tight',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      <span className={cn('flex flex-col gap-0.5', align === 'right' ? 'items-end' : 'items-start')}>
        <span className="inline-flex items-center gap-1 uppercase tracking-wide text-fg-muted">
          <span>{primary}</span>
          {showSortGlyph ? (
            <ArrowUpDown
              className="h-3 w-3 shrink-0 opacity-0 transition-opacity duration-100 group-hover/th:opacity-100"
              strokeWidth={2}
              aria-hidden
            />
          ) : null}
        </span>
        <span className="text-[10px] font-normal normal-case tracking-normal text-fg-muted/90">
          {secondary}
        </span>
      </span>
    </th>
  );
}

function HolderRowView({
  row,
  rowIndex,
  decimals,
  mint,
  creatorWallet,
  tokenSym,
  nativeSym,
}: {
  row: HolderRow;
  rowIndex: number;
  decimals: number;
  mint: string;
  creatorWallet: string | null;
  tokenSym: string;
  nativeSym: string;
}) {
  const hoverProps = useEntityHover(
    useMemo(
      () => ({ type: 'wallet' as const, id: row.wallet_address }),
      [row.wallet_address],
    ),
  );

  const qtyUi = rawToUi(row.amount_raw, decimals);
  const zebra = rowIndex % 2 === 0 ? 'bg-desk-a' : 'bg-desk-b';
  const synth = buildHolderDeskSynth({
    wallet: row.wallet_address,
    mint,
    qtyUi,
    pctSupply: row.pct_of_supply,
  });

  const pnlTone =
    synth.uPnlUsd > 0 ? 'text-signal-bull' : synth.uPnlUsd < 0 ? 'text-signal-bear' : 'text-fg-muted';
  const pctRemain = row.pct_of_supply != null ? row.pct_of_supply : synth.pctLine;
  const barW = Math.min(100, Math.max(6, pctRemain));

  return (
    <tr
      className={cn(
        'group cursor-pointer border-b border-border-subtle/30 transition-colors hover:bg-bg-hover/30',
        zebra,
      )}
      {...hoverProps}
    >
      <td className="px-2.5 py-2.5 align-middle text-[11px] font-medium tabular-nums text-fg-muted">
        {row.rank ?? '\u2014'}
      </td>
      <td className="min-w-[170px] px-2.5 py-2.5 align-middle" title={row.wallet_address}>
        <span className="inline-flex items-center gap-1.5 text-[12px] leading-snug">
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
            className="text-[12px] text-fg-secondary hover:text-accent-primary"
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
      <td className="px-2.5 py-2.5 text-right align-middle">
        <div className="text-[12px] font-medium tabular-nums text-fg-primary">
          {formatNumber(synth.solBalance, { decimals: 3 })}
          <span className="mx-1 text-[10px] text-fg-muted">{nativeSym}</span>
        </div>
        <div className="mt-0.5 text-[10px] tabular-nums text-fg-muted">({synth.lastActive})</div>
      </td>
      <td className="w-[132px] px-2.5 py-2.5 text-right align-middle">
        <div className="text-[12px] font-semibold tabular-nums text-signal-bull">
          {formatCompactUsd(synth.boughtUsd)}
        </div>
        <div className="mt-0.5 text-[10px] leading-snug text-fg-muted">
          <span>{formatNumber(synth.boughtTokensCompact, { compact: true })}</span>
          <span className="text-fg-muted/70">
            {' '}
            / {synth.buyTxCount}
          </span>
        </div>
        {synth.avgBuyUsd != null ? (
          <div className="text-[10px] tabular-nums text-fg-muted">{formatCompactUsd(synth.avgBuyUsd)}</div>
        ) : null}
      </td>
      <td className="w-[132px] px-2.5 py-2.5 text-right align-middle">
        <div className="text-[12px] font-semibold tabular-nums text-signal-bear">
          {formatCompactUsd(synth.soldUsd)}
        </div>
        <div className="mt-0.5 text-[10px] leading-snug text-fg-muted">
          <span>{formatNumber(synth.soldTokensCompact, { compact: true })}</span>
          {synth.sellTxCount ? (
            <span className="text-fg-muted/70">
              {' '}
              / {synth.sellTxCount}
            </span>
          ) : (
            <span className="text-fg-muted/70"> · 0</span>
          )}
        </div>
        {synth.avgSellUsd != null ? (
          <div className="text-[10px] tabular-nums text-fg-muted">{formatCompactUsd(synth.avgSellUsd)}</div>
        ) : (
          <div className="text-[10px] text-fg-muted">{'\u2014'}</div>
        )}
      </td>
      <td
        className={cn(
          'w-[112px] px-2.5 py-2.5 text-right align-middle text-[12px] font-semibold tabular-nums leading-snug',
          pnlTone,
        )}
      >
        {synth.uPnlUsd >= 0 ? '+' : ''}
        {formatCompactUsd(synth.uPnlUsd)}
      </td>
      <td className="relative w-[148px] px-2 py-2.5 align-middle">
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-2 left-2 top-2 max-w-[calc(100%-1rem)] rounded-sm bg-gradient-to-r from-signal-info/45 to-signal-info/5"
          style={{ width: `${barW}%` }}
        />
        <div className="relative flex flex-col items-end gap-0.5 pr-0.5 text-right leading-tight">
          <span className="text-[12px] font-semibold tabular-nums text-fg-primary">
            {formatCompactUsd(synth.remainingUsd)}
          </span>
          <span className="text-[10px] tabular-nums text-fg-muted">{formatPercent(pctRemain)}</span>
        </div>
      </td>
      <td className="min-w-[128px] px-2 py-2.5 align-middle">
        <div className="flex items-start justify-end gap-2 text-right">
          <div className="min-w-0 space-y-0.5 leading-tight">
            <span className="block text-[12px] font-medium text-fg-primary">{synth.funding.venue}</span>
            <span className="block text-[10px] tabular-nums text-fg-muted">{synth.funding.ageSinceFund}</span>
            <span className="block text-[10px] tabular-nums text-fg-secondary">
              {formatNumber(synth.funding.solFunding, { decimals: 2 })}{' '}
              <span className="text-fg-muted">{nativeSym}</span>
            </span>
          </div>
          <span
            aria-hidden
            title="Funding badge (indexed funding graph replacing placeholder soon)"
            className="mt-0.5 h-6 w-6 shrink-0 rounded-full shadow-inner ring-1 ring-white/[0.08]"
            style={{ backgroundColor: `rgb(${synth.funding.brandRgb} / 0.88)` }}
          />
        </div>
      </td>
      <td className="px-2.5 py-2.5 text-right align-middle text-[12px] font-semibold tabular-nums text-signal-info">
        {synth.heldAge}
      </td>
      <td className="w-[92px] px-2.5 py-2.5 align-middle">
        <span className="inline-flex flex-wrap items-center gap-1">
          {row.is_dev ? <FlagTag tone="dev">DEV</FlagTag> : null}
          {row.is_sniper ? <FlagTag tone="sniper">SNIPER</FlagTag> : null}
          {!row.is_dev && !row.is_sniper ? (
            <span className="text-[10px] text-fg-muted">{'\u2014'}</span>
          ) : null}
        </span>
      </td>
    </tr>
  );
}

function FlagTag({ children, tone }: { children: string; tone: 'dev' | 'sniper' }) {
  const palette =
    tone === 'dev'
      ? 'border-0 bg-fg-muted/15 text-fg-secondary'
      : 'border-0 bg-signal-bear/18 text-signal-bear';
  return (
    <span
      className={cn(
        'inline-flex h-[18px] items-center rounded px-1.5 text-[10px] font-semibold uppercase leading-none tracking-wide',
        palette,
      )}
    >
      {children}
    </span>
  );
}
