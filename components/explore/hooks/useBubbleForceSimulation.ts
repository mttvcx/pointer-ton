'use client';

import {
  forceCenter,
  forceCollide,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TokenExploreItem } from '@/types/explore';

/* useLayoutEffect on the client writes positions before paint (so bubbles
 * never flash from (0,0)); useEffect on the server avoids the React SSR
 * warning. Alias is selected once at module load — order stays stable. */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Live d3-force simulation that drives Explore bubbles imperatively.
 *
 * Why imperative? With 10–80 bubbles ticking at ~60fps, routing positions
 * through React state thrashes the reconciler. Instead, the hook:
 *  - owns the simulation + nodes
 *  - registers each bubble's DOM element via a callback ref
 *  - writes `transform: translate(x, y) translate(-50%, -50%)` directly
 *    on each element from a single `tick` handler
 *
 * React only renders when bubbles enter/leave the cohort, when search /
 * highlight state flips, or when `anyDragging` toggles (so visual state
 * like tooltip suppression can react).
 */

export type BubbleSimNode = SimulationNodeDatum & {
  id: string;
  r: number;
  weight: number;
};

type Box = { w: number; h: number };

const EDGE_PAD = 18;
const CLICK_THRESHOLD_PX = 6;
const DRAG_ALPHA_TARGET = 0.18;
const SETTLE_ALPHA = 0.36;

export const BUBBLE_CLICK_THRESHOLD_PX = CLICK_THRESHOLD_PX;

/** Visual radius for an item, clamped to the available canvas. Used by both
 * the simulation (for forceCollide) and the bubble element (for width/height). */
export function resolveBubbleRadius(item: TokenExploreItem, box: Box): number {
  if (box.w === 0 || box.h === 0) return Math.max(38, item.displayRadius);
  const minSide = Math.min(box.w, box.h);
  const maxAllowed = Math.max(46, Math.floor(minSide * 0.15));
  return Math.min(maxAllowed, Math.max(40, item.displayRadius));
}

type Args = {
  items: TokenExploreItem[];
  box: Box;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Honor `prefers-reduced-motion` — shorter settle, no idle drift. */
  reducedMotion: boolean;
};

export type BubbleSimHandle = ReturnType<typeof useBubbleForceSimulation>;

export function useBubbleForceSimulation({ items, box, containerRef, reducedMotion }: Args) {
  const simRef = useRef<Simulation<BubbleSimNode, undefined> | null>(null);
  const nodesRef = useRef<Map<string, BubbleSimNode>>(new Map());
  const elsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const draggingRef = useRef<Set<string>>(new Set());
  const [anyDragging, setAnyDragging] = useState(false);

  const writeTransform = useCallback((node: BubbleSimNode) => {
    const el = elsRef.current.get(node.id);
    if (!el) return;
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (box.w < 80 || box.h < 80 || items.length === 0) {
      simRef.current?.stop();
      simRef.current = null;
      return;
    }

    const cx = box.w / 2;
    /** Slightly above geometric center so clusters read “floating upward” (launchpad bubble pools). */
    const cy = box.h * 0.4;

    /* Compose nodes, preserving prior positions for stable ids so the
     * field doesn't repack from scratch when the cohort changes order. */
    const prevNodes = nodesRef.current;
    const nextList: BubbleSimNode[] = items.map((it, idx) => {
      const r = resolveBubbleRadius(it, box);
      const prev = prevNodes.get(it.tokenAddress);
      if (prev) {
        prev.r = r;
        prev.weight = Math.max(0.05, Math.min(1, it.mindshareScore / 100));
        return prev;
      }
      const angle = (idx / Math.max(1, items.length)) * Math.PI * 2 + idx * 0.37;
      const ring = Math.min(box.w, box.h) * 0.3;
      return {
        id: it.tokenAddress,
        r,
        weight: Math.max(0.05, Math.min(1, it.mindshareScore / 100)),
        x: cx + Math.cos(angle) * ring,
        y: cy + Math.sin(angle) * ring,
        vx: 0,
        vy: 0,
      };
    });

    const nextMap = new Map<string, BubbleSimNode>();
    for (const n of nextList) nextMap.set(n.id, n);
    nodesRef.current = nextMap;

    simRef.current?.stop();

    const sim = forceSimulation<BubbleSimNode>(nextList)
      .force(
        'charge',
        forceManyBody<BubbleSimNode>()
          .strength(() => -15)
          .distanceMax(Math.min(box.w, box.h) * 0.95),
      )
      .force(
        'collide',
        forceCollide<BubbleSimNode>((d) => d.r + 4)
          .strength(0.88)
          .iterations(4),
      )
      .force('cx', forceX<BubbleSimNode>(cx).strength((d) => 0.045 + d.weight * 0.055))
      .force('cy', forceY<BubbleSimNode>(cy).strength((d) => 0.038 + d.weight * 0.052))
      .force('center', forceCenter<BubbleSimNode>(cx, cy).strength(0.015))
      .alphaDecay(reducedMotion ? 0.05 : 0.026)
      .velocityDecay(0.56)
      .alphaMin(0.0012)
      .alphaTarget(0)
      .stop()
      .on('tick', () => {
        for (const n of nextList) {
          if (n.x == null || n.y == null) continue;
          const m = n.r + EDGE_PAD;
          n.x = Math.min(box.w - m, Math.max(m, n.x));
          n.y = Math.min(box.h - m, Math.max(m, n.y));
          writeTransform(n);
        }
      });

    simRef.current = sim;

    /* Cool to a packed initial state synchronously so the first paint is
     * already settled. `simulation.tick()` advances forces but does NOT fire
     * the `tick` event handler, so we write transforms manually after the
     * loop. The internal timer stays off until a drag calls `restart()`. */
    sim.alpha(0.9);
    const coolTicks = reducedMotion ? 180 : 320;
    for (let i = 0; i < coolTicks; i++) {
      sim.tick();
      if (sim.alpha() < 0.015) break;
    }
    /* Also clamp inside the inner box bounds (the tick callback would do this
     * if it had fired). */
    for (const n of nextList) {
      if (n.x == null || n.y == null) continue;
      const m = n.r + EDGE_PAD;
      n.x = Math.min(box.w - m, Math.max(m, n.x));
      n.y = Math.min(box.h - m, Math.max(m, n.y));
      writeTransform(n);
    }

    return () => {
      sim.stop();
    };
  }, [items, box.w, box.h, reducedMotion, writeTransform]);

  const registerEl = useCallback(
    (id: string, el: HTMLDivElement | null) => {
      if (el) {
        elsRef.current.set(id, el);
        const node = nodesRef.current.get(id);
        if (node) writeTransform(node);
      } else {
        elsRef.current.delete(id);
      }
    },
    [writeTransform],
  );

  const clientToBox = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: clientX, y: clientY };
      return { x: clientX - rect.left, y: clientY - rect.top };
    },
    [containerRef],
  );

  const startDrag = useCallback(
    (id: string, clientX: number, clientY: number) => {
      const sim = simRef.current;
      const node = nodesRef.current.get(id);
      if (!sim || !node) return;
      const { x, y } = clientToBox(clientX, clientY);
      node.fx = x;
      node.fy = y;
      draggingRef.current.add(id);
      if (draggingRef.current.size === 1) setAnyDragging(true);
      sim.alphaTarget(DRAG_ALPHA_TARGET).restart();
    },
    [clientToBox],
  );

  const moveDrag = useCallback(
    (id: string, clientX: number, clientY: number) => {
      const node = nodesRef.current.get(id);
      if (!node) return;
      const { x, y } = clientToBox(clientX, clientY);
      /* keep dragged node inside the canvas so it can't be flung off-screen. */
      const m = node.r + EDGE_PAD;
      node.fx = Math.min(box.w - m, Math.max(m, x));
      node.fy = Math.min(box.h - m, Math.max(m, y));
    },
    [box.h, box.w, clientToBox],
  );

  const endDrag = useCallback(
    (id: string) => {
      const sim = simRef.current;
      const node = nodesRef.current.get(id);
      if (!sim || !node) return;
      node.fx = null;
      node.fy = null;
      draggingRef.current.delete(id);
      if (draggingRef.current.size === 0) {
        setAnyDragging(false);
        /* `.restart()` is idempotent and guarantees the stepper resumes if the
         * timer happened to be idle (e.g., very quick pointer down → up). */
        sim
          .alphaTarget(0)
          .alpha(reducedMotion ? 0.18 : SETTLE_ALPHA)
          .restart();
      }
    },
    [reducedMotion],
  );

  const getPosition = useCallback((id: string): { x: number; y: number } | null => {
    const n = nodesRef.current.get(id);
    if (!n || n.x == null || n.y == null) return null;
    return { x: n.x, y: n.y };
  }, []);

  return {
    anyDragging,
    registerEl,
    startDrag,
    moveDrag,
    endDrag,
    getPosition,
  };
}
