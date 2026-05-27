'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { formatCompactUsd, formatAgeShort, formatDuration } from '@/lib/format';
import { DevTokenStatsPanel } from './DevTokenStatsPanel';
import {
  DESK_CELL_CLASS,
  DESK_CELL_FIRST_CLASS,
  DESK_CELL_LAST_CLASS,
  DESK_HEADER_CLASS,
  DESK_ROW_CLASS,
  DESK_STICKY_HEAD_CLASS,
  CELL_PRIMARY_CLASS,
  CELL_MUTED_CLASS,
} from './cells/deskTokens';
import { PnlCell } from './cells/PnlCell';
import { SortableTh } from './cells/SortableTh';
import { DeskHeaderSettings } from './cells/DeskHeaderSettings';
import type { SyntheticDevTokenRow } from '@/lib/dev/demoTokenFixtures';
import type { DevWalletStatsRow } from '@/lib/db/wallets';

type Props = {
  creatorWallet: string;
  dev: DevWalletStatsRow | null;
  tokens: SyntheticDevTokenRow[];
};

export function DevTokensPane({ creatorWallet, dev, tokens }: Props) {
  const sortedByLaunch = [...tokens].sort(
    (a, b) => new Date(b.launchedAt).getTime() - new Date(a.launchedAt).getTime(),
  );
  const lastLaunchAgo = sortedByLaunch[0]
    ? `${formatAgeShort(sortedByLaunch[0].launchedAt)} ago`
    : '\u2014';

  return (
    <div className="flex h-full flex-col">
      <CreatorStatStrip creatorWallet={creatorWallet} dev={dev} />
      <div className="flex min-h-0 flex-1 divide-x divide-border-subtle">
        <div className="relative min-w-0 flex-1 overflow-auto">
          <DevTokensTable tokens={tokens} />
        </div>
        <div className="w-[320px] shrink-0 overflow-auto border-l border-border-subtle/25">
          <DevTokenStatsPanel tokens={tokens} lastLaunchAgo={lastLaunchAgo} />
        </div>
      </div>
    </div>
  );
}

function CreatorStatStrip({
  creatorWallet,
  dev,
}: {
  creatorWallet: string;
  dev: DevWalletStatsRow | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-border-subtle/25 px-3 py-1 text-[10px] leading-tight">
      <span className="font-sans tabular-nums text-fg-secondary">
        {creatorWallet.slice(0, 6)}…{creatorWallet.slice(-4)}
      </span>
      <span className="hidden text-fg-muted/40 sm:inline">·</span>
      <Stat label="Launched" value={dev?.tokens_launched ?? 0} tone="neutral" />
      <Stat label="Mooned" value={dev?.tokens_mooned ?? 0} tone="bull" />
      <Stat label="Rugged" value={dev?.tokens_rugged ?? 0} tone="bear" />
      {dev?.median_time_to_rug_seconds != null && dev.median_time_to_rug_seconds > 0 ? (
        <>
          <span className="hidden text-fg-muted/40 sm:inline">·</span>
          <span className="text-fg-muted">
            Median t-to-rug:{' '}
            <span className="font-sans tabular-nums text-fg-secondary">
              {formatDuration(dev.median_time_to_rug_seconds)}
            </span>
          </span>
        </>
      ) : null}
      {dev?.reputation_score != null ? (
        <>
          <span className="hidden text-fg-muted/40 sm:inline">·</span>
          <span className="text-fg-muted">
            Rep:{' '}
            <span className="font-sans tabular-nums text-fg-secondary">
              {dev.reputation_score}
            </span>
          </span>
        </>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'bull' | 'bear';
}) {
  const toneClass =
    tone === 'bull'
      ? 'text-signal-bull'
      : tone === 'bear'
        ? 'text-signal-bear'
        : 'text-fg-primary';
  return (
    <span className="flex items-center gap-1">
      <span className="text-fg-muted">{label}:</span>
      <span className={cn('font-sans tabular-nums font-medium', toneClass)}>{value}</span>
    </span>
  );
}

function DevTokensTable({ tokens }: { tokens: SyntheticDevTokenRow[] }) {
  type DevSortKey =
    | 'token'
    | 'mcUsd'
    | 'athUsd'
    | 'liquidityUsd'
    | 'volume1hUsd'
    | 'balanceUsd'
    | 'pnlUsd';

  const [sortKey, setSortKey] = useState<DevSortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);

  const cycleSort = (key: DevSortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('desc');
      return;
    }
    if (sortDir === 'desc') {
      setSortDir('asc');
      return;
    }
    setSortKey(null);
    setSortDir(null);
  };

  const colSort = (key: DevSortKey): 'asc' | 'desc' | null =>
    sortKey === key ? sortDir : null;

  const sortedTokens = useMemo(() => {
    const copy = [...tokens];
    if (!sortKey || !sortDir) {
      return copy.sort(
        (a, b) => new Date(b.launchedAt).getTime() - new Date(a.launchedAt).getTime(),
      );
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'token':
          diff = new Date(a.launchedAt).getTime() - new Date(b.launchedAt).getTime();
          break;
        case 'mcUsd':
          diff = a.mcUsd - b.mcUsd;
          break;
        case 'athUsd':
          diff = a.athUsd - b.athUsd;
          break;
        case 'liquidityUsd':
          diff = a.liquidityUsd - b.liquidityUsd;
          break;
        case 'volume1hUsd':
          diff = a.volume1hUsd - b.volume1hUsd;
          break;
        case 'balanceUsd':
          diff = a.balanceUsd - b.balanceUsd;
          break;
        case 'pnlUsd':
          diff = a.pnlUsd - b.pnlUsd;
          break;
        default:
          break;
      }
      return diff * dir;
    });
    return copy;
  }, [tokens, sortKey, sortDir]);

  return (
    <table className="w-full min-w-[820px] table-fixed border-collapse">
      <colgroup>
        <col className="w-[140px]" />
        <col className="w-[80px]" />
        <col className="w-[80px]" />
        <col className="w-[90px]" />
        <col className="w-[90px]" />
        <col className="w-[90px]" />
        <col className="w-[90px]" />
        <col className="w-[90px]" />
        <col className="w-[100px]" />
        <col className="w-[28px]" />
      </colgroup>
      <thead className={DESK_STICKY_HEAD_CLASS}>
        <tr>
          <SortableTh
            label="Token"
            className="pl-3"
            sortDir={colSort('token')}
            onSort={() => cycleSort('token')}
          />
          <th className={DESK_HEADER_CLASS}>Migrated</th>
          <th className={DESK_HEADER_CLASS}>Dex</th>
          <SortableTh
            label="Market Cap"
            align="right"
            sortDir={colSort('mcUsd')}
            onSort={() => cycleSort('mcUsd')}
          />
          <SortableTh
            label="ATH"
            align="right"
            sortDir={colSort('athUsd')}
            onSort={() => cycleSort('athUsd')}
          />
          <SortableTh
            label="Liquidity"
            align="right"
            sortDir={colSort('liquidityUsd')}
            onSort={() => cycleSort('liquidityUsd')}
          />
          <SortableTh
            label="1h Volume"
            align="right"
            sortDir={colSort('volume1hUsd')}
            onSort={() => cycleSort('volume1hUsd')}
          />
          <SortableTh
            label="Bal."
            align="right"
            sortDir={colSort('balanceUsd')}
            onSort={() => cycleSort('balanceUsd')}
          />
          <SortableTh
            label="PnL"
            align="right"
            className="pr-3"
            sortDir={colSort('pnlUsd')}
            onSort={() => cycleSort('pnlUsd')}
          />
          <DeskHeaderSettings />
        </tr>
      </thead>
      <tbody>
        {sortedTokens.map((t) => (
          <tr key={t.mint} className={DESK_ROW_CLASS}>
            <td className={DESK_CELL_FIRST_CLASS}>
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 shrink-0 rounded-full bg-fg-muted/20" />
                <div className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-[12px] font-medium text-fg-primary">
                    {t.symbol}
                  </span>
                  <span className="text-[10.5px] text-fg-muted">
                    {formatAgeShort(t.launchedAt)} ago
                  </span>
                </div>
              </div>
            </td>
            <td className={DESK_CELL_CLASS}>
              {t.migrated ? (
                <span className="text-signal-bull">✓</span>
              ) : (
                <span className="text-fg-muted/40">{'\u2014'}</span>
              )}
            </td>
            <td className={DESK_CELL_CLASS}>
              {t.dex ? (
                <span className="text-[11px] text-fg-secondary">{t.dex}</span>
              ) : (
                <span className="text-fg-muted/40">{'\u2014'}</span>
              )}
            </td>
            <td className={cn(DESK_CELL_CLASS, 'text-right')}>
              <span className={CELL_PRIMARY_CLASS}>
                {formatCompactUsd(t.mcUsd)}
              </span>
            </td>
            <td className={cn(DESK_CELL_CLASS, 'text-right')}>
              <span className={CELL_MUTED_CLASS}>
                {formatCompactUsd(t.athUsd)}
              </span>
            </td>
            <td className={cn(DESK_CELL_CLASS, 'text-right')}>
              <span className={CELL_MUTED_CLASS}>
                {formatCompactUsd(t.liquidityUsd)}
              </span>
            </td>
            <td className={cn(DESK_CELL_CLASS, 'text-right')}>
              <span className={CELL_MUTED_CLASS}>
                {formatCompactUsd(t.volume1hUsd)}
              </span>
            </td>
            <td className={cn(DESK_CELL_CLASS, 'text-right')}>
              <span className={CELL_MUTED_CLASS}>
                {formatCompactUsd(t.balanceUsd)}
              </span>
            </td>
            <td className={cn(DESK_CELL_LAST_CLASS, 'text-right')}>
              <PnlCell
                value={t.pnlUsd}
                display={`${t.pnlUsd >= 0 ? '+' : ''}${formatCompactUsd(t.pnlUsd)}`}
                size="hero"
              />
            </td>
            <td className="w-8 p-0" aria-hidden />
          </tr>
        ))}
      </tbody>
    </table>
  );
}
