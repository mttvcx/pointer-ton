'use client';

import {
  DEFAULT_X_MONITOR_PEEK_SIZE,
  useTokenDockPeekStore,
} from '@/store/tokenDockPeek';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';

/** Detach embedded pulse X monitor into a floating / edge-dockable panel. */
export function openXMonitorFloat(anchor?: DOMRect | null) {
  const peek = useTokenDockPeekStore.getState();
  const x = anchor ? Math.round(anchor.left) : peek.dockXMonitorPosition.x;
  const y = anchor ? Math.round(anchor.top) : peek.dockXMonitorPosition.y;
  if (anchor) {
    peek.setXMonitorPanelSize({
      width: Math.round(anchor.width),
      height: Math.round(anchor.height),
    });
  }
  peek.setDockXMonitorPosition({ x, y });
  peek.setXMonitorDockSnap(null);
  peek.setXMonitorPeekOpen(true);
  usePulseTwitterRailStore.getState().setSide('hidden');
}

/** Re-embed on Pulse after edge snap (left / right column). */
export function embedXMonitorOnPulse(side: 'left' | 'right') {
  const peek = useTokenDockPeekStore.getState();
  peek.setXMonitorPeekOpen(false);
  peek.setXMonitorDockSnap(null);
  usePulseTwitterRailStore.getState().setSide(side);
}
