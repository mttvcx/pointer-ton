'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { BubbleMap } from '@/components/tokens/BubbleMap';
import { InsightXDetailView, type InsightXDetailTab } from '@/components/tokens/InsightXDetailView';
import type { BubbleLink, BubbleNode } from '@/lib/tokens/bubbleMap';
import { useWalletLabels } from '@/lib/hooks/useWalletLabels';
import { shortenAddress } from '@/lib/utils/addresses';
import { formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';

type PanelView = 'map' | InsightXDetailTab;
const VIEW_TABS: { id: PanelView; label: string }[] = [
  { id: 'map', label: 'Map' },
  { id: 'bundlers', label: 'Bundlers' },
  { id: 'snipers', label: 'Snipers' },
  { id: 'insiders', label: 'Insiders' },
  { id: 'security', label: 'Security' },
];

/** App chain → InsightX network (null = no InsightX coverage, e.g. ton). */
function ixNetworkFor(chain: string | null | undefined): string | null {
  switch (chain) {
    case 'sol':
      return 'sol';
    case 'eth':
      return 'eth';
    case 'base':
      return 'base';
    case 'bnb':
      return 'bsc';
    default:
      return null;
  }
}

type IxBubbleResp = {
  configured: boolean;
  nodes?: BubbleNode[];
  links?: BubbleLink[];
  summary?: { nodeCount: number; linkCount: number; clusterCount: number; clusteredPct: number };
  error?: string;
};

type HolderRow = {
  wallet_address: string;
  pct_of_supply: number | null;
  is_dev: boolean | null;
  is_sniper: boolean | null;
  rank?: number | null;
};
type HoldersResp = {
  holders: HolderRow[];
  holderCountTotal?: number | null;
  top10HolderPct?: number | null;
  devHoldingPct?: number | null;
  poolAddresses?: string[];
};

const LEGEND: { label: string; color: string }[] = [
  { label: 'Dev', color: '#ef4444' },
  { label: 'Sniper', color: '#f59e0b' },
  { label: 'LP', color: '#94a3b8' },
  { label: 'Holder', color: '#60a5fa' },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] font-semibold uppercase tracking-wide text-fg-muted">{label}</span>
      <span className="text-[13px] font-semibold tabular-nums text-fg-primary">{value}</span>
    </div>
  );
}

/**
 * Holder bubble map panel — real top-holder data sized by % held, tinted by
 * dev/sniper/LP role. Wallet clusters, bundle detection and the AI risk read
 * are honestly gated until an InsightX key is connected (no fabricated links).
 */
export function BubbleMapPanel({ mint }: { mint: string; symbol?: string }) {
  const { resolveLabel } = useWalletLabels();
  const activeChain = useUIStore((s) => s.activeChain);
  const ixNetwork = ixNetworkFor(activeChain);
  const [view, setView] = useState<PanelView>('map');

  const q = useQuery({
    queryKey: ['bubble-holders', mint],
    queryFn: async () => {
      const r = await fetch(`/api/tokens/${encodeURIComponent(mint)}/holders`);
      if (!r.ok) throw new Error('holders_failed');
      return (await r.json()) as HoldersResp;
    },
    staleTime: 60_000,
  });

  // InsightX graph (real clusters + funding links) — only when a key is set.
  // The route returns { configured:false } cheaply, so this never burns quota
  // until connected. Cached 15m client-side to respect the free-tier budget.
  const ixQ = useQuery({
    queryKey: ['ix-bubble', mint, ixNetwork],
    queryFn: async () => {
      const r = await fetch(
        `/api/insightx/token/${encodeURIComponent(mint)}?network=${ixNetwork}`,
      );
      return (await r.json()) as IxBubbleResp;
    },
    enabled: Boolean(ixNetwork),
    staleTime: 15 * 60_000,
    retry: false,
  });

  const ixConfigured = ixQ.data?.configured === true;
  const ixNodes = ixQ.data?.nodes ?? [];
  const useIx = ixConfigured && ixNodes.length > 0;

  const holderNodes = useMemo<BubbleNode[]>(() => {
    const holders = q.data?.holders ?? [];
    const pools = new Set(q.data?.poolAddresses ?? []);
    return holders
      .filter((h) => h.pct_of_supply != null && h.pct_of_supply > 0)
      .map((h, i) => {
        const lab = resolveLabel(h.wallet_address, 4);
        const role = pools.has(h.wallet_address)
          ? ('lp' as const)
          : h.is_dev
            ? ('dev' as const)
            : h.is_sniper
              ? ('sniper' as const)
              : undefined;
        return {
          id: h.wallet_address,
          label: lab?.labeled ? lab.label : shortenAddress(h.wallet_address, 4),
          pct: Math.min(100, Math.max(0, h.pct_of_supply ?? 0)),
          cluster: role ? 0 : (i % 6) + 1,
          role,
        };
      });
  }, [q.data, resolveLabel]);

  // Prefer InsightX's real cluster graph (nodes + funding links) when connected;
  // otherwise our own top-holder bubbles (no fabricated links).
  const nodes = useIx ? ixNodes : holderNodes;
  const links: BubbleLink[] = useIx ? (ixQ.data?.links ?? []) : [];

  const top10 = q.data?.top10HolderPct;
  const devPct = q.data?.devHoldingPct;
  const holderCount = q.data?.holderCountTotal;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-desk-panel">
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border-subtle/40 px-2 py-1 [scrollbar-width:none]">
        {VIEW_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setView(t.id)}
            className={cn(
              'btn-press shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
              view === t.id ? 'bg-bg-hover text-fg-primary' : 'text-fg-muted hover:text-fg-secondary',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view !== 'map' ? (
        <InsightXDetailView mint={mint} network={ixNetwork} tab={view} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Seamless stat strip — same surface as the panel, hairline divider only. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-border-subtle/25 px-3.5 py-2">
            <Stat label="Holders" value={holderCount != null ? formatNumber(holderCount, { compact: holderCount >= 10_000 }) : '—'} />
            <Stat label="Top 10" value={top10 != null ? `${top10.toFixed(1)}%` : '—'} />
            <Stat label="Dev holds" value={devPct != null ? `${devPct.toFixed(2)}%` : '—'} />
            {useIx && ixQ.data?.summary ? (
              <Stat label="Clusters" value={String(ixQ.data.summary.clusterCount ?? 0)} />
            ) : null}
            <div className="ml-auto flex items-center gap-2.5">
              {LEGEND.map((l) => (
                <span key={l.label} className="flex items-center gap-1 text-[10px] text-fg-muted">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>

          {/* Full-bleed graph — sits directly on the panel surface, no nested box. */}
          <div className="relative min-h-0 flex-1">
            {q.isLoading ? (
              <div className="flex h-full items-center justify-center gap-2 text-[12px] text-fg-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading holders…
              </div>
            ) : q.isError ? (
              <div className="flex h-full items-center justify-center text-[12px] text-fg-muted">
                Holder data unavailable for this token.
              </div>
            ) : nodes.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[12px] text-fg-muted">
                No holder distribution indexed yet.
              </div>
            ) : (
              <BubbleMap nodes={nodes} links={links} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
