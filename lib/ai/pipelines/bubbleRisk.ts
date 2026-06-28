import 'server-only';

import { runCascade, type CascadeMode } from '@/lib/ai/cascade';
import { BubbleRiskOutputSchema, type BubbleRiskOutput } from '@/lib/ai/schemas';
import {
  ixBundlers,
  ixClusters,
  ixInsiders,
  ixSnipers,
  type IxNetwork,
} from '@/lib/insightx/client';
import { normalizeClusters } from '@/lib/insightx/normalize';
import { recognizedWalletFromRegistry } from '@/lib/identity/bridgeWalletIntel';
import type { AppChainId } from '@/lib/chains/appChain';
import { getLatestSnapshotForMint, getTokenByMint } from '@/lib/db/tokens';

export { BubbleRiskOutputSchema };

const IX_TO_APP: Partial<Record<IxNetwork, AppChainId>> = {
  sol: 'sol',
  eth: 'eth',
  base: 'base',
  bsc: 'bnb',
};

const pct = (v: number | null | undefined) => (v == null ? 'unknown' : `${v.toFixed(1)}%`);

export interface BubbleRiskInput {
  mint: string;
  userId: string;
  network: IxNetwork;
  mode?: CascadeMode;
}

type Facts = {
  symbol: string | null;
  name: string | null;
  holderCount: number | null;
  top10Pct: number | null;
  devPct: number | null;
  clusteredPct: number | null;
  clusterCount: number;
  bundlersPct: number | null;
  bundlerCount: number;
  snipersPct: number | null;
  sniperCount: number;
  insidersPct: number | null;
  insiderCount: number;
  namedInClusters: string[];
};

function buildPrompt(f: Facts): { system: string; user: string } {
  const system = [
    'You are Pointer, a skeptical Solana on-chain risk analyst reading holder-distribution and coordinated-wallet data for a memecoin.',
    'Be terse, specific, numbers over adjectives. Never give buy/sell advice.',
    'Treat coordinated wallet clusters, bundling, sniping and insider concentration as risk signals — weigh how much of supply each controls. More coordinated/bundled/insider supply held = higher rug/dump risk. Low holder counts and high top-10 concentration compound it.',
  ].join(' ');

  const L: string[] = [];
  L.push(`Token: ${f.symbol ?? 'token'}${f.name ? ` (${f.name})` : ''}`);
  if (f.holderCount != null) L.push(`Holders: ${f.holderCount}`);
  if (f.top10Pct != null) L.push(`Top 10 holders control: ${pct(f.top10Pct)} of supply`);
  if (f.devPct != null) L.push(`Dev still holds: ${pct(f.devPct)}`);
  L.push(`Coordinated wallet clusters: ${f.clusterCount} clusters controlling ${pct(f.clusteredPct)} of supply`);
  L.push(`Bundlers: ${f.bundlerCount} wallets holding ${pct(f.bundlersPct)} of supply`);
  L.push(`Snipers: ${f.sniperCount} wallets holding ${pct(f.snipersPct)} of supply`);
  L.push(`Insiders: ${f.insiderCount} wallets holding ${pct(f.insidersPct)} of supply`);
  if (f.namedInClusters.length > 0) {
    L.push(`Known wallets seen inside clusters: ${f.namedInClusters.join(', ')}`);
  }

  const user = [
    'Assess the rug/dump risk of this token using ONLY the holder + coordination facts below.',
    '',
    L.join('\n'),
    '',
    'Respond as JSON matching this schema:',
    '{ "riskLevel": "low" | "medium" | "high" | "critical",',
    '  "headline": string (<=130 chars, one-line verdict leading with the single most important number),',
    '  "factors": array (max 6) of { "label": string (<=46), "detail": string (<=200), "severity": "info" | "warn" | "critical" },',
    '  "summary": string (<=600 chars, 2-4 sentences) }',
  ].join('\n');

  return { system, user };
}

/**
 * AI risk read of a token's holder bubble map — synthesizes InsightX cluster /
 * bundler / sniper / insider concentration + holder distribution into a graded
 * risk verdict via the shared cascade (cached per mint/network, quota-billed).
 */
export async function analyzeBubbleRisk(input: BubbleRiskInput): Promise<{
  data: BubbleRiskOutput;
  cacheHit: boolean;
  modelUsed: string;
  costUsd: number;
}> {
  const { mint, network } = input;
  const appChain = IX_TO_APP[network];

  const [clusters, bundlers, snipers, insiders, token, snapshot] = await Promise.all([
    ixClusters(network, mint).catch(() => null),
    ixBundlers(network, mint).catch(() => null),
    ixSnipers(network, mint).catch(() => null),
    ixInsiders(network, mint).catch(() => null),
    getTokenByMint(mint).catch(() => null),
    getLatestSnapshotForMint(mint).catch(() => null),
  ]);

  // Name up to 5 known KOL/smart/whale wallets that appear inside clusters.
  const namedInClusters: string[] = [];
  if (appChain && clusters) {
    const seen = new Set<string>();
    for (const node of normalizeClusters(clusters).nodes) {
      if (namedInClusters.length >= 5) break;
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      const rec = recognizedWalletFromRegistry(appChain, node.id);
      if (rec) namedInClusters.push(rec.displayName);
    }
  }

  const facts: Facts = {
    symbol: token?.symbol ?? null,
    name: token?.name ?? null,
    holderCount: snapshot?.holder_count ?? null,
    top10Pct: snapshot?.top10_holder_pct ?? null,
    devPct: snapshot?.dev_holding_pct ?? null,
    clusteredPct: clusters?.total_cluster_pct ?? null,
    clusterCount: clusters?.clusters?.length ?? 0,
    bundlersPct: bundlers?.total_bundlers_pct ?? null,
    bundlerCount: bundlers?.bundlers?.length ?? 0,
    snipersPct: snipers?.total_snipers_pct ?? null,
    sniperCount: snipers?.snipers?.length ?? 0,
    insidersPct: insiders?.total_insiders_pct ?? null,
    insiderCount: insiders?.insiders?.length ?? 0,
    namedInClusters,
  };

  const { system, user } = buildPrompt(facts);

  const result = await runCascade({
    pipeline: 'bubbleRisk',
    userId: input.userId,
    mode: input.mode ?? 'fast',
    inputs: { mint, network, mode: input.mode ?? 'fast' },
    systemPrompt: system,
    userPrompt: user,
  });

  return {
    data: result.data as BubbleRiskOutput,
    cacheHit: result.cacheHit,
    modelUsed: result.modelUsed,
    costUsd: result.costUsd,
  };
}
