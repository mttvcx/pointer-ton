'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { Maximize2, Minus, Plus } from 'lucide-react';
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

const MIN_K = 0.35;
const MAX_K = 9;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Transform = { x: number; y: number; k: number };
type DragState =
  | { mode: 'pan'; startX: number; startY: number; originX: number; originY: number }
  | { mode: 'node'; id: string; grabDX: number; grabDY: number }
  | null;

/**
 * Interactive force-directed holder bubble map. Bubbles sized by % held, colored
 * by cluster / flagged role, linked into related-wallet groups. Pan by dragging
 * empty space, zoom with the wheel (toward the cursor) or the +/- controls, and
 * drag individual bubbles to pull a cluster apart.
 */
export function BubbleMap({
  nodes,
  links,
  width = 560,
  height = 460,
}: {
  nodes: BubbleNode[];
  links: BubbleLink[];
  width?: number;
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<SimNode | null>(null);
  const [t, setT] = useState<Transform>({ x: 0, y: 0, k: 1 });
  // Per-node position overrides (from dragging a bubble), in simulation space.
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const drag = useRef<DragState>(null);

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

  // New token / dataset → reset view + any dragged positions.
  useEffect(() => {
    setT({ x: 0, y: 0, k: 1 });
    setPositions({});
    drag.current = null;
  }, [nodes, links]);

  const colorOf = (n: BubbleNode) =>
    n.role ? ROLE_COLORS[n.role] : CLUSTER_COLORS[n.cluster % CLUSTER_COLORS.length];
  const posOf = (n: SimNode) => positions[n.id] ?? { x: n.x ?? width / 2, y: n.y ?? height / 2 };

  // Client (screen) coords → SVG viewBox coords, robust to letterboxing/scaling.
  const clientToSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };
  const svgToSim = (p: { x: number; y: number }, tr: Transform) => ({
    x: (p.x - tr.x) / tr.k,
    y: (p.y - tr.y) / tr.k,
  });

  // Wheel zoom toward the cursor. Native non-passive listener so we can
  // preventDefault the page scroll.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = clientToSvg(e.clientX, e.clientY);
      setT((cur) => {
        const k2 = clamp(cur.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15), MIN_K, MAX_K);
        const ratio = k2 / cur.k;
        return { k: k2, x: p.x - ratio * (p.x - cur.x), y: p.y - ratio * (p.y - cur.y) };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const id = (e.target as Element).getAttribute?.('data-node-id');
    svgRef.current?.setPointerCapture?.(e.pointerId);
    const p = clientToSvg(e.clientX, e.clientY);
    if (id) {
      const sim = svgToSim(p, t);
      const cur = positions[id] ?? (() => {
        const n = layout.nodes.find((x) => x.id === id);
        return { x: n?.x ?? width / 2, y: n?.y ?? height / 2 };
      })();
      drag.current = { mode: 'node', id, grabDX: sim.x - cur.x, grabDY: sim.y - cur.y };
    } else {
      drag.current = { mode: 'pan', startX: p.x, startY: p.y, originX: t.x, originY: t.y };
    }
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = clientToSvg(e.clientX, e.clientY);
    if (d.mode === 'pan') {
      setT((cur) => ({ ...cur, x: d.originX + (p.x - d.startX), y: d.originY + (p.y - d.startY) }));
    } else {
      const sim = svgToSim(p, t);
      setPositions((cur) => ({ ...cur, [d.id]: { x: sim.x - d.grabDX, y: sim.y - d.grabDY } }));
    }
  };

  const endDrag = (e: ReactPointerEvent<SVGSVGElement>) => {
    drag.current = null;
    svgRef.current?.releasePointerCapture?.(e.pointerId);
  };

  const zoomBy = (factor: number) =>
    setT((cur) => {
      const k2 = clamp(cur.k * factor, MIN_K, MAX_K);
      const ratio = k2 / cur.k;
      const cx = width / 2;
      const cy = height / 2;
      return { k: k2, x: cx - ratio * (cx - cur.x), y: cy - ratio * (cy - cur.y) };
    });
  const reset = () => {
    setT({ x: 0, y: 0, k: 1 });
    setPositions({});
  };

  const ctrlBtn =
    'flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-raised/90 text-fg-secondary backdrop-blur transition-colors hover:bg-bg-hover hover:text-fg-primary';

  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full touch-none select-none"
        style={{ cursor: drag.current?.mode === 'pan' ? 'grabbing' : 'grab' }}
        role="img"
        aria-label="Holder bubble map — drag to pan, scroll to zoom"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => setHover(null)}
      >
        <g transform={`translate(${t.x} ${t.y}) scale(${t.k})`}>
          <g stroke="rgba(255,255,255,0.10)" strokeWidth={1} vectorEffect="non-scaling-stroke">
            {layout.links.map((l, i) => {
              const a = l.source as SimNode;
              const b = l.target as SimNode;
              const pa = posOf(a);
              const pb = posOf(b);
              return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} />;
            })}
          </g>
          <g>
            {layout.nodes.map((n) => {
              const p = posOf(n);
              const r = layout.radius(n);
              return (
                <circle
                  key={n.id}
                  data-node-id={n.id}
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={colorOf(n)}
                  fillOpacity={hover && hover.id !== n.id ? 0.4 : 0.88}
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover((h) => (h?.id === n.id ? null : h))}
                  className="cursor-grab transition-[fill-opacity] duration-150 active:cursor-grabbing"
                />
              );
            })}
          </g>
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-2 right-2 flex flex-col gap-1">
        <button type="button" aria-label="Zoom in" className={ctrlBtn} onClick={() => zoomBy(1.3)}>
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
        <button type="button" aria-label="Zoom out" className={ctrlBtn} onClick={() => zoomBy(1 / 1.3)}>
          <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
        <button type="button" aria-label="Reset view" className={ctrlBtn} onClick={reset}>
          <Maximize2 className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-bg-raised/70 px-2 py-1 text-[9px] text-fg-muted backdrop-blur">
        Drag to pan · scroll to zoom · drag a bubble to move it
      </div>

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
