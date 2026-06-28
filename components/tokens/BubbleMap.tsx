'use client';

import { useMemo, useState } from 'react';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import type { BubbleLink, BubbleNode } from '@/lib/tokens/bubbleMap';

type SimNode = BubbleNode & SimulationNodeDatum;

const CLUSTER_COLORS = [
  '#34d399', '#60a5fa', '#f59e0b', '#f472b6', '#a78bfa',
  '#22d3ee', '#fb7185', '#a3e635', '#fbbf24', '#38bdf8',
];
const ROLE_COLORS: Record<NonNullable<BubbleNode['role']>, string> = {
  dev: '#ef4444',
  sniper: '#f59e0b',
  bundler: '#a78bfa',
  insider: '#fb7185',
  lp: '#94a3b8',
  kol: '#34d399',
};

/**
 * Force-directed holder bubble map (d3-force, static layout). Bubbles sized by %
 * held, colored by cluster / flagged role, linked into related-wallet groups.
 */
export function BubbleMap({
  nodes,
  links,
  width = 520,
  height = 440,
}: {
  nodes: BubbleNode[];
  links: BubbleLink[];
  width?: number;
  height?: number;
}) {
  const [hover, setHover] = useState<SimNode | null>(null);

  const layout = useMemo(() => {
    const sim: SimNode[] = nodes.map((n) => ({ ...n }));
    const ids = new Set(sim.map((n) => n.id));
    const simLinks: SimulationLinkDatum<SimNode>[] = links
      .filter((l) => ids.has(l.source) && ids.has(l.target))
      .map((l) => ({ source: l.source, target: l.target }));
    const radius = (n: BubbleNode) => 5 + Math.sqrt(Math.max(0, n.pct)) * 8;
    const s = forceSimulation(sim)
      .force('charge', forceManyBody<SimNode>().strength(-26))
      .force('center', forceCenter(width / 2, height / 2))
      .force(
        'link',
        forceLink<SimNode, SimulationLinkDatum<SimNode>>(simLinks)
          .id((d) => d.id)
          .distance(34)
          .strength(0.7),
      )
      .force('collide', forceCollide<SimNode>().radius((n) => radius(n) + 2))
      .stop();
    for (let i = 0; i < 320; i++) s.tick();
    return { nodes: sim, links: simLinks, radius };
  }, [nodes, links, width, height]);

  const colorOf = (n: BubbleNode) =>
    n.role ? ROLE_COLORS[n.role] : CLUSTER_COLORS[n.cluster % CLUSTER_COLORS.length];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Holder bubble map">
        <g stroke="rgba(255,255,255,0.10)" strokeWidth={1}>
          {layout.links.map((l, i) => {
            const a = l.source as SimNode;
            const b = l.target as SimNode;
            if (a.x == null || b.x == null) return null;
            return <line key={i} x1={a.x} y1={a.y ?? 0} x2={b.x} y2={b.y ?? 0} />;
          })}
        </g>
        <g>
          {layout.nodes.map((n) => {
            if (n.x == null) return null;
            const r = layout.radius(n);
            return (
              <circle
                key={n.id}
                cx={n.x}
                cy={n.y ?? 0}
                r={r}
                fill={colorOf(n)}
                fillOpacity={hover && hover.id !== n.id ? 0.4 : 0.88}
                stroke="rgba(0,0,0,0.4)"
                strokeWidth={1}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover((h) => (h?.id === n.id ? null : h))}
                className="cursor-pointer transition-[fill-opacity] duration-150"
              />
            );
          })}
        </g>
      </svg>
      {hover ? (
        <div className="pointer-events-none absolute left-2 top-2 rounded-md border border-border-subtle bg-bg-raised px-2.5 py-1.5 text-[11px] shadow-lg">
          <div className="font-semibold text-fg-primary">
            {hover.label ?? `${hover.id.slice(0, 4)}…${hover.id.slice(-4)}`}
          </div>
          <div className="tabular-nums text-fg-muted">
            {hover.pct.toFixed(2)}% held{hover.role ? ` · ${hover.role}` : ''}
          </div>
        </div>
      ) : null}
    </div>
  );
}
