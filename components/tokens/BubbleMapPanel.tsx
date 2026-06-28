'use client';

import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Lock, Sparkles } from 'lucide-react';
import { BubbleMap } from '@/components/tokens/BubbleMap';
import type { BubbleLink, BubbleNode } from '@/lib/tokens/bubbleMap';
import { useWalletLabels } from '@/lib/hooks/useWalletLabels';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { shortenAddress } from '@/lib/utils/addresses';
import { formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';

type RiskSeverity = 'info' | 'warn' | 'critical';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type BubbleRisk = {
  riskLevel: RiskLevel;
  headline: string;
  factors: { label: string; detail: string; severity: RiskSeverity }[];
  summary: string;
};
type RiskResp = { configured: boolean; risk?: BubbleRisk; cached?: boolean; error?: string };

const RISK_TONE: Record<RiskLevel, string> = {
  low: 'border-signal-bull/40 bg-signal-bull/10 text-signal-bull',
  medium: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400',
  high: 'border-orange-500/40 bg-orange-500/10 text-orange-400',
  critical: 'border-signal-bear/40 bg-signal-bear/10 text-signal-bear',
};
const SEVERITY_DOT: Record<RiskSeverity, string> = {
  info: 'bg-fg-muted',
  warn: 'bg-yellow-400',
  critical: 'bg-signal-bear',
};

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

  const { getAccessToken } = usePointerAuth();
  const riskMut = useMutation({
    mutationFn: async (): Promise<RiskResp> => {
      const tkn = await getAccessToken();
      const r = await fetch(`/api/insightx/risk/${encodeURIComponent(mint)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tkn ? { Authorization: `Bearer ${tkn}` } : {}),
        },
        body: JSON.stringify({ network: ixNetwork }),
      });
      const json = (await r.json().catch(() => ({}))) as RiskResp;
      if (!r.ok) throw new Error(json.error || 'analyze_failed');
      return json;
    },
  });
  const risk = riskMut.data?.risk;

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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-desk-panel">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border-subtle/40 px-4 py-2.5">
        <Stat label="Holders" value={holderCount != null ? formatNumber(holderCount, { compact: holderCount >= 10_000 }) : '—'} />
        <Stat label="Top 10" value={top10 != null ? `${top10.toFixed(1)}%` : '—'} />
        <Stat label="Dev holds" value={devPct != null ? `${devPct.toFixed(2)}%` : '—'} />
        <div className="ml-auto flex items-center gap-3">
          {LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-fg-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 lg:flex-row">
        <div className="relative min-h-[320px] flex-1 rounded-xl border border-border-subtle bg-bg-sunken/40 p-2">
          {q.isLoading ? (
            <div className="flex h-full min-h-[300px] items-center justify-center gap-2 text-[12px] text-fg-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading holders…
            </div>
          ) : q.isError ? (
            <div className="flex h-full min-h-[300px] items-center justify-center text-[12px] text-fg-muted">
              Holder data unavailable for this token.
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex h-full min-h-[300px] items-center justify-center text-[12px] text-fg-muted">
              No holder distribution indexed yet.
            </div>
          ) : (
            <BubbleMap nodes={nodes} links={links} />
          )}
        </div>

        {/* AI risk read — honestly locked until InsightX is connected. */}
        <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-72">
          <div className="rounded-xl border border-border-subtle bg-bg-sunken/40 p-3.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent-primary" strokeWidth={2} />
              <span className="text-[12px] font-semibold text-fg-primary">AI risk read</span>
              <span
                className={
                  'ml-auto inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ' +
                  (useIx
                    ? 'border-signal-bull/40 text-signal-bull'
                    : 'border-border-subtle text-fg-muted')
                }
              >
                {useIx ? 'Live' : <><Lock className="h-2.5 w-2.5" /> Locked</>}
              </span>
            </div>
            {useIx ? (
              <div className="mt-2">
                {risk ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                          RISK_TONE[risk.riskLevel],
                        )}
                      >
                        {risk.riskLevel} risk
                      </span>
                      {riskMut.data?.cached ? (
                        <span className="text-[9px] uppercase tracking-wide text-fg-muted">cached</span>
                      ) : null}
                    </div>
                    <p className="text-[11px] font-semibold leading-snug text-fg-primary">{risk.headline}</p>
                    {risk.factors.length > 0 ? (
                      <ul className="flex flex-col gap-1.5">
                        {risk.factors.map((f, i) => (
                          <li key={i} className="flex gap-1.5">
                            <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', SEVERITY_DOT[f.severity])} />
                            <span className="text-[10.5px] leading-snug text-fg-muted">
                              <span className="font-semibold text-fg-secondary">{f.label}:</span> {f.detail}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="text-[10.5px] leading-relaxed text-fg-muted">{risk.summary}</p>
                    <button
                      type="button"
                      onClick={() => riskMut.mutate()}
                      disabled={riskMut.isPending}
                      className="self-start text-[10px] font-semibold uppercase tracking-wide text-accent-primary transition hover:underline disabled:opacity-50"
                    >
                      Re-analyze
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <p className="text-[11px] leading-relaxed text-fg-muted">
                      InsightX connected — <span className="text-fg-secondary">{ixQ.data?.summary?.clusterCount ?? 0} coordinated clusters</span>,{' '}
                      <span className="text-fg-secondary">{(ixQ.data?.summary?.clusteredPct ?? 0).toFixed(1)}% of supply</span> clustered. Let the AI grade the rug risk.
                    </p>
                    <button
                      type="button"
                      onClick={() => riskMut.mutate()}
                      disabled={riskMut.isPending}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent-primary px-3 py-1.5 text-[11px] font-semibold text-fg-inverse transition hover:brightness-110 disabled:opacity-60"
                    >
                      {riskMut.isPending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" /> Analyze risk
                        </>
                      )}
                    </button>
                    {riskMut.isError ? (
                      <p className="text-[10px] text-signal-bear">
                        {(riskMut.error instanceof Error ? riskMut.error.message : '') === 'unauthenticated'
                          ? 'Sign in to run the AI risk read.'
                          : 'Risk read failed — try again.'}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2 text-[11px] leading-relaxed text-fg-muted">
                Connect an InsightX key to reveal <span className="text-fg-secondary">wallet clusters</span>,{' '}
                <span className="text-fg-secondary">bundle &amp; sniper detection</span> and funding links — then
                the AI reads the map: who&apos;s coordinated, how much they hold, and the rug risk.
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border-subtle bg-bg-sunken/40 p-3.5">
            <p className="text-[11px] leading-relaxed text-fg-muted">
              {useIx ? (
                <>
                  Showing <span className="font-semibold text-fg-primary">{nodes.length}</span> wallets from InsightX,
                  linked by funding/transfer relationships. Red = dev, amber = sniper, violet = bundler, grey = LP.
                </>
              ) : (
                <>
                  Showing <span className="font-semibold text-fg-primary">{nodes.length}</span> top holders sized by
                  supply. Red = dev, amber = sniper, grey = LP. Cluster lines appear once InsightX is connected.
                </>
              )}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
