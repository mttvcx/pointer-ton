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

/** Normalize the cluster-metrics payload (nodes only — no edges) as a fallback. */
export function normalizeClusters(raw: unknown): BubbleMapData {
  const root = (raw ?? {}) as Record<string, unknown>;
  const clustersRaw = pick<unknown[]>(root, ['clusters', 'data', 'items']) ?? [];
  const nodes: BubbleNode[] = [];
  (Array.isArray(clustersRaw) ? clustersRaw : []).forEach((raw, ci) => {
    const c = (raw ?? {}) as Record<string, unknown>;
    const tag = pick(c, ['tag', 'tags', 'type']);
    const role = tagToRole(tag);
    const members = pick<unknown[]>(c, ['wallets', 'members', 'addresses']) ?? [];
    (Array.isArray(members) ? members : []).forEach((m, mi) => {
      const w = (typeof m === 'string' ? { address: m } : (m ?? {})) as Record<string, unknown>;
      nodes.push({
        id: String(pick(w, ['address', 'wallet', 'id']) ?? `${ci}-${mi}`),
        label: pick<string>(w, ['label', 'name']) || undefined,
        pct: num(pick(w, ['percentage', 'percent', 'pct'])),
        cluster: ci + 1,
        role,
      });
    });
  });
  return { nodes, links: [] };
}

/** Best-effort bubble data: prefer Atlas (has links); fall back to clusters. */
export function bubbleFromInsightx(atlas: unknown, clusters: unknown): BubbleMapData {
  const a = normalizeAtlas(atlas);
  if (a.nodes.length > 0) return a;
  return normalizeClusters(clusters);
}
