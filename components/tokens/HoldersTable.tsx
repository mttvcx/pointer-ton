'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableRowSkeleton } from '@/components/shared/Skeleton';
import { syntheticHoldersResponse } from '@/lib/dev/demoTokenFixtures';
import { demoTablesEnabled } from '@/lib/dev/demoPolicy';
import { preferTokenTableDemoRows } from '@/lib/dev/uiDemoMode';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';
import { rawToUi } from '@/lib/utils/formatters';
import type { TraderDeskFilter } from '@/lib/walletIdentity/traderFilters';
import { holderRowMatchesFilter } from '@/lib/walletIdentity/traderFilters';
import { useTrackedWalletsLookup } from '@/lib/hooks/useTrackedWalletsLookup';
import { useWalletLabels } from '@/lib/hooks/useWalletLabels';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { useUIStore } from '@/store/ui';
import { holderDeskFromWalletStats } from '@/lib/indexer/holderDeskFromStats';
import type { MintWalletStatsRow } from '@/lib/db/mintWalletStats';
import { buildHolderDeskSynth, EMPTY_HOLDER_DESK_SYNTH } from '@/lib/tokens/holderDeskSynth';
import { HoldersDeskTable, type HolderDeskRow } from '@/components/tokens/HoldersDeskTable';
import { DESK_SCROLL_WELL_CLASS } from '@/components/tokens/cells/deskTokens';
import { cn } from '@/lib/utils/cn';

type HoldersResponse = {
  mint: string;
  decimals: number;
  holders: HolderDeskRow[];
  walletStats?: Record<string, MintWalletStatsRow>;
  indexerSource?: string | null;
};

export function HoldersTable({
  mint,
  creatorWallet = null,
  tokenSymbol,
  onlyTracked = false,
  deskFilter = 'all',
  onFilterMintTrades,
  tradesMakerFilter = null,
  onOpenSettings,
}: {
  mint: string;
  creatorWallet?: string | null;
  tokenSymbol?: string | null;
  onlyTracked?: boolean;
  deskFilter?: TraderDeskFilter;
  onFilterMintTrades?: (address: string) => void;
  tradesMakerFilter?: string | null;
  onOpenSettings?: () => void;
}) {
  const uiDemo = useUiDemoMode();
  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);
  const [uPnlSortDir, setUPnlSortDir] = useState<'asc' | 'desc' | null>(null);
  const { isTracked } = useTrackedWalletsLookup();
  const { resolveLabel } = useWalletLabels();
  const demoRows = useMemo(() => syntheticHoldersResponse(mint, 9), [mint]);

  const tableDemoEnv = preferTokenTableDemoRows();
  const demoTables = demoTablesEnabled(uiDemo);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['token-holders', mint],
    queryFn: async (): Promise<HoldersResponse> => {
      const r = await fetch(`/api/tokens/${encodeURIComponent(mint)}/holders`);
      if (!r.ok) throw new Error('holders_failed');
      return r.json() as Promise<HoldersResponse>;
    },
    placeholderData: demoTables ? demoRows : undefined,
    staleTime: 60_000,
  });

  const filled = useMemo(() => {
    const decimals = data?.decimals ?? 9;
    if (tableDemoEnv || (uiDemo && (isError || !data || data.holders.length === 0))) {
      return syntheticHoldersResponse(mint, decimals);
    }
    if (isError || !data?.holders?.length) {
      return { mint, decimals, holders: [] as HolderDeskRow[] };
    }
    return data;
  }, [mint, data, isError, uiDemo, tableDemoEnv]);

  const sym = tokenSymbol ?? 'TOK';
  const decimals = filled?.decimals ?? 9;

  const visibleRows = useMemo(() => {
    const base =
      filled?.holders.filter((h) => {
        if (onlyTracked && !isTracked(h.wallet_address)) return false;
        if (deskFilter === 'all') return true;
        return holderRowMatchesFilter({
          row: h,
          creatorWallet,
          tracked: isTracked(h.wallet_address),
          labelDisp: resolveLabel(h.wallet_address, 5),
          filter: deskFilter,
        });
      }) ?? [];

    const statsMap = data?.walletStats ?? {};
    const enriched = base.map((h) => {
      const indexed = statsMap[h.wallet_address];
      const pctLine =
        h.pct_of_supply != null && Number.isFinite(h.pct_of_supply)
          ? Math.min(100, Math.max(0, h.pct_of_supply))
          : 0;
      if (demoTables) {
        return {
          ...h,
          synth: buildHolderDeskSynth({
            wallet: h.wallet_address,
            mint,
            qtyUi: rawToUi(h.amount_raw, decimals),
            pctSupply: h.pct_of_supply,
          }),
        };
      }
      if (indexed && (indexed.buy_usd > 0 || indexed.sell_usd > 0)) {
        return {
          ...h,
          synth: holderDeskFromWalletStats(indexed, h.pct_of_supply, decimals),
        };
      }
      return { ...h, synth: { ...EMPTY_HOLDER_DESK_SYNTH, pctLine } };
    });

    if (!uPnlSortDir) return enriched;
    return [...enriched].sort((a, b) => {
      const diff = a.synth.uPnlUsdRaw - b.synth.uPnlUsdRaw;
      return uPnlSortDir === 'asc' ? diff : -diff;
    });
  }, [
    filled?.holders,
    deskFilter,
    onlyTracked,
    creatorWallet,
    isTracked,
    resolveLabel,
    mint,
    decimals,
    uPnlSortDir,
    demoTables,
    data?.walletStats,
  ]);

  const filteredEmpty =
    !!filled?.holders?.length && visibleRows.length === 0 && deskFilter !== 'all';

  const handleSortUPnL = () => {
    setUPnlSortDir((d) => (d === null ? 'desc' : d === 'desc' ? 'asc' : null));
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col font-sans text-[12px] leading-snug text-fg-primary">
      {isLoading && !filled ? (
        <table className="w-full border-collapse text-left text-xs">
          <tbody>
            {Array.from({ length: 8 }, (_, i) => (
              <TableRowSkeleton key={i} cols={9} />
            ))}
          </tbody>
        </table>
      ) : filteredEmpty ? (
        <EmptyState
          icon={Users}
          title="No holders match filters"
          description="Clear pills or widen the lens."
        />
      ) : filled ? (
        <div className={cn('desk-scroll-well', DESK_SCROLL_WELL_CLASS)}>
            <HoldersDeskTable
              rows={visibleRows}
              mint={mint}
              tokenSymbol={sym}
              creatorWallet={creatorWallet}
              nativeSym={nativeSym}
              onSortUPnL={handleSortUPnL}
              sortDir={uPnlSortDir}
              onFilterMintTrades={onFilterMintTrades}
              tradesMakerFilter={tradesMakerFilter}
              onOpenSettings={onOpenSettings}
            />
        </div>
      ) : null}
    </section>
  );
}
