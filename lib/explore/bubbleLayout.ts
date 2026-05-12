import type { SimulationNodeDatum } from 'd3-force';
import { forceCollide, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import type { TokenExploreItem } from '@/types/explore';

export type BubbleNodeDatum = SimulationNodeDatum & {
  id: string;
  r: number;
  /** Higher mindshare gravitates inward */
  weight: number;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Deterministic jitter from id for stable initials
 */
function hash01(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  const u = h >>> 0;
  return (u % 997) / 997;
}

/** Run a cooled force simulation synchronously — ok for Explore-sized cohorts. */
export function layoutExploreBubbles(
  items: TokenExploreItem[],
  width: number,
  height: number,
  prevPositions: Map<string, { x: number; y: number }>,
  opts?: { ticks?: number },
): BubbleNodeDatum[] {
  const pad = 32;
  const cx = width / 2;
  const cy = height * 0.46;
  if (items.length === 0 || width < 120 || height < 120) return [];

  const maxR = Math.max(44, ...items.map((i) => i.displayRadius));
  if (width < maxR * 2 || height < maxR * 2) return [];

  const maxAllowedR = clamp(Math.floor(Math.min(width, height) * 0.148), 50, 97);

  const nodes: BubbleNodeDatum[] = items.map((it, idx) => {
    const rr = clamp(it.displayRadius, 41, maxAllowedR);
    const angle = (idx / Math.max(1, items.length)) * Math.PI * 2 + hash01(it.tokenAddress) * 0.52;
    const ringBase = Math.min(width, height) * 0.36;
    const ring = ringBase + hash01(`${it.tokenAddress}-rad`) * (Math.min(width, height) * 0.1);
    const prev = prevPositions.get(it.tokenAddress);
    const x = prev?.x ?? cx + Math.cos(angle) * ring;
    const y = prev?.y ?? cy + Math.sin(angle) * ring;
    /* weight: heavier mindshare attracts to center stronger */
    const w = clamp(it.mindshareScore / 100, 0.05, 1);
    return { id: it.tokenAddress, r: rr, weight: w, index: idx, vx: 0, vy: 0, x, y };
  });

  const sim = forceSimulation(nodes)
    .force(
      'charge',
      forceManyBody<BubbleNodeDatum>()
        .strength(() => (nodes.length > 88 ? -4.8 : -5.9))
        .distanceMax(Math.min(width, height) * 0.92),
    )
    .force('collide', forceCollide<BubbleNodeDatum>((d) => d.r + 5).strength(0.97).iterations(5))
    .force('cx', forceX<BubbleNodeDatum>(cx).strength((d) => 0.068 + d.weight * 0.11))
    .force('cy', forceY<BubbleNodeDatum>(cy).strength((d) => 0.06 + d.weight * 0.09))
    .alphaDecay(0.022)
    .velocityDecay(0.66)
    .stop();

  const tickCap = opts?.ticks ?? (items.length > 80 ? 500 : 400);
  for (let i = 0; i < tickCap; i++) {
    sim.tick();
    for (const d of nodes) {
      if (d.x == null || d.y == null) continue;
      const m = d.r + pad;
      d.x = clamp(d.x, m, width - m);
      d.y = clamp(d.y, m, height - m);
    }
    if ((sim.alpha() ?? 0) < 0.006) break;
  }

  return nodes;
}
