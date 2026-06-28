/**
 * Bubble-map model — token holders as bubbles (sized by % held), linked into
 * clusters of related wallets (shared funder / coordinated buys). Data-agnostic:
 * populated from InsightX cluster/Atlas data once the API key is set; a demo
 * generator backs the viz until then.
 */

export type BubbleRole = 'dev' | 'sniper' | 'bundler' | 'insider' | 'lp' | 'kol';

export type BubbleNode = {
  id: string;
  /** Wallet name / KOL handle when known (from our Labels DB / InsightX). */
  label?: string;
  /** Percent of supply held (0..100) — drives bubble size. */
  pct: number;
  /** Cluster id — related wallets share a color. */
  cluster: number;
  /** Role tint for flagged wallets. */
  role?: BubbleRole;
};

export type BubbleLink = { source: string; target: string };

export type BubbleMapData = { nodes: BubbleNode[]; links: BubbleLink[] };

/** Representative demo map (LP + dev + bundler/sniper/insider/KOL clusters). */
export function demoBubbleMap(): BubbleMapData {
  const nodes: BubbleNode[] = [
    { id: 'LP', label: 'Liquidity pool', pct: 18, cluster: 0, role: 'lp' },
    { id: 'DEV', label: 'Dev', pct: 6, cluster: 1, role: 'dev' },
  ];
  const links: BubbleLink[] = [];

  const clusters: { hub: string; role: BubbleRole; cluster: number; members: number; hubPct: number }[] = [
    { hub: 'bundle', role: 'bundler', cluster: 2, members: 6, hubPct: 4 },
    { hub: 'sniper', role: 'sniper', cluster: 3, members: 5, hubPct: 3 },
    { hub: 'insider', role: 'insider', cluster: 4, members: 4, hubPct: 2.5 },
    { hub: 'kol', role: 'kol', cluster: 5, members: 3, hubPct: 2 },
  ];

  let seq = 0;
  for (const c of clusters) {
    nodes.push({ id: c.hub, label: c.role, pct: c.hubPct, cluster: c.cluster, role: c.role });
    links.push({ source: 'DEV', target: c.hub });
    for (let i = 0; i < c.members; i++) {
      const id = `w${seq++}`;
      nodes.push({ id, pct: 0.3 + (i % 3) * 0.5, cluster: c.cluster });
      links.push({ source: c.hub, target: id });
    }
  }
  for (let i = 0; i < 12; i++) {
    nodes.push({ id: `h${seq++}`, pct: 0.2 + (i % 4) * 0.3, cluster: i % 6 });
  }

  return { nodes, links };
}
