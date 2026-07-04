import type { IxClustersResp } from '@/lib/insightx/client';
import type { BubbleLink, BubbleMapData, BubbleNode, BubbleRole } from '@/lib/tokens/bubbleMap';

/**
 * Tolerant normalizers for InsightX Atlas / cluster payloads → our BubbleMap
 * model. The exact field names aren't published in the OpenAPI spec, so we probe
 * the common shapes (nodes|holders, links|edges, percentage|pct, source|from…).
 * Once a live key reveals the real schema we tighten these to the exact fields.
 */

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}

function pick<T = unknown>(obj: Record<string, unknown>, keys: string[]): T | undefined {
  for (const k of keys) if (obj[k] != null) return obj[k] as T;
  return undefined;
}

/** Map an InsightX tag/type onto a bubble role tint. */
export function tagToRole(tag: unknown): BubbleRole | undefined {
  const tags = Array.isArray(tag) ? tag.map(String) : tag != null ? [String(tag)] : [];
  const set = new Set(tags.map((t) => t.toLowerCase()));
  if (set.has('team') || set.has('dev') || set.has('creator')) return 'dev';
  if (set.has('liquidity_pool') || set.has('lp') || set.has('pool')) return 'lp';
  if (set.has('sniper')) return 'sniper';
  if (set.has('bundler') || set.has('bundle')) return 'bundler';
  if (set.has('insider')) return 'insider';
  if (set.has('kol')) return 'kol';
  return undefined;
}

/** Normalize an Atlas latest-snapshot payload into bubble nodes + links. */
export function normalizeAtlas(raw: unknown): BubbleMapData {
  const root = (raw ?? {}) as Record<string, unknown>;
  const graph = (root.graph ?? root.data ?? root) as Record<string, unknown>;
  const nodesRaw = pick<unknown[]>(graph, ['nodes', 'holders', 'wallets']) ?? [];
  const linksRaw = pick<unknown[]>(graph, ['links', 'edges', 'relationships', 'connections']) ?? [];

  const nodes: BubbleNode[] = (Array.isArray(nodesRaw) ? nodesRaw : []).map((raw, i) => {
    const n = (raw ?? {}) as Record<string, unknown>;
    const id = String(pick(n, ['address', 'id', 'wallet', 'account']) ?? i);
    const label = pick<string>(n, ['label', 'name', 'handle']);
    const cluster = num(pick(n, ['cluster', 'cluster_id', 'group', 'community']));
    const tag = pick(n, ['tag', 'tags', 'type', 'category']);
    return {
      id,
      label: label || undefined,
      pct: num(pick(n, ['percentage', 'percent', 'pct', 'supply_pct', 'pct_of_supply'])),
      cluster: cluster || 0,
      role: tagToRole(tag),
    };
  });

  const ids = new Set(nodes.map((n) => n.id));
  const links: BubbleLink[] = (Array.isArray(linksRaw) ? linksRaw : [])
    .map((raw) => {
      const l = (raw ?? {}) as Record<string, unknown>;
      return {
        source: String(pick(l, ['source', 'from', 'a', 'src']) ?? ''),
        target: String(pick(l, ['target', 'to', 'b', 'dst']) ?? ''),
      };
    })
    .filter((l) => l.source && l.target && ids.has(l.source) && ids.has(l.target));

  return { nodes, links };
}

/**
 * Normalize the cluster-metrics payload into bubble nodes + synthesized links.
 * Each cluster is a group of coordinated wallets; we color members by cluster,
 * size by their `percentage`, and draw a star of links from each cluster's
 * largest member to the rest (the endpoint has no explicit edges). Addresses are
 * de-duped across clusters (first wins).
 */
export function normalizeClusters(raw: IxClustersResp | null | undefined): BubbleMapData {
  const clusters = raw?.clusters ?? [];
  const nodes: BubbleNode[] = [];
  const links: BubbleLink[] = [];
  const seen = new Set<string>();

  clusters.forEach((c, ci) => {
    const clusterId = ci + 1;
    const clusterRole = tagToRole(c.tags);
    const members = (c.cluster_addresses ?? []).filter((m) => m && m.address && !seen.has(m.address));
    if (members.length === 0) return;

    const memberIds: string[] = [];
    let anchorIdx = 0;
    let anchorPct = -1;
    members.forEach((m, i) => {
      const id = String(m.address);
      seen.add(id);
      memberIds.push(id);
      const pct = num(m.percentage);
      if (pct > anchorPct) {
        anchorPct = pct;
        anchorIdx = i;
      }
      nodes.push({
        id,
        pct,
        cluster: clusterId,
        role: tagToRole(m.tags) ?? clusterRole,
      });
    });

    // Star topology: connect every member to the cluster's largest holder.
    const anchor = memberIds[anchorIdx];
    if (anchor) {
      memberIds.forEach((id, i) => {
        if (i !== anchorIdx) links.push({ source: anchor, target: id });
      });
    }
  });

  return { nodes, links };
}

/** Layer Atlas labels (CEX/KOL names) onto cluster nodes by address. */
export function applyAtlasLabels(data: BubbleMapData, atlas: unknown): BubbleMapData {
  const root = (atlas ?? {}) as Record<string, unknown>;
  const holders = pick<unknown[]>(root, ['holders', 'nodes', 'wallets']) ?? [];
  const labelByAddr = new Map<string, string>();
  (Array.isArray(holders) ? holders : []).forEach((raw) => {
    const h = (raw ?? {}) as Record<string, unknown>;
    const addr = pick<string>(h, ['address', 'wallet']);
    const label = pick<string>(h, ['label', 'name']);
    // Skip Atlas's "Funding: <shortaddr>" echo labels — keep only real names.
    if (addr && label && !/^funding:/i.test(label.trim())) labelByAddr.set(addr, label);
  });
  if (labelByAddr.size === 0) return data;
  return {
    links: data.links,
    nodes: data.nodes.map((n) => (labelByAddr.has(n.id) ? { ...n, label: labelByAddr.get(n.id) } : n)),
  };
}
