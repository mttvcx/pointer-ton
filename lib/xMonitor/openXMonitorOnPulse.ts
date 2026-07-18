'use client';

import { goToPulse, isOnPulseRoute, isOnTokenRoute } from '@/lib/navigation/clientNavigate';
import { DEFAULT_X_MONITOR_POS, pickFreeDockSide, useTokenDockPeekStore } from '@/store/tokenDockPeek';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { useUIStore } from '@/store/ui';

export function isXMonitorOpen(): boolean {
  return (
    usePulseTwitterRailStore.getState().side !== 'hidden' ||
    useTokenDockPeekStore.getState().xMonitorPeekOpen
  );
}

export function closeXMonitor() {
  usePulseTwitterRailStore.getState().setSide('hidden');
  const peek = useTokenDockPeekStore.getState();
  // Just hide it — KEEP the dock snap / floating position / size so reopening
  // from the topbar restores it exactly where the user left it (same behaviour
  // as the instant-trade dock).
  peek.setXMonitorPeekOpen(false);
}

/** Pulse side rail — closes duplicate popouts/floats. */
export function openXMonitorOnPulse(side: 'left' | 'right' = 'left') {
  const peek = useTokenDockPeekStore.getState();

  const ui = useUIStore.getState();
  ui.setAlertRulesModalOpen(false);
  ui.setAlertRulesDocked(false);
  ui.setAlertRulesPopout(null);

  usePulseTwitterRailStore.getState().setSide('hidden');

  // Reopen exactly where the user last left it. Its dock snap, floating position
  // and size are all persisted; only pick a fresh free side on the very first
  // open (no remembered snap AND still at the default floating anchor).
  const savedSnap = peek.dockXMonitorDockSnap;
  const pos = peek.dockXMonitorPosition;
  const hasFloatingMemory =
    !!pos && (pos.x !== DEFAULT_X_MONITOR_POS.x || pos.y !== DEFAULT_X_MONITOR_POS.y);
  if (savedSnap == null && !hasFloatingMemory) {
    peek.setXMonitorDockSnap(pickFreeDockSide('xMonitor') ?? side);
  }
  peek.setXMonitorPeekOpen(true);

  if (isOnPulseRoute() || isOnTokenRoute()) return;
  goToPulse();
}

export function toggleXMonitorOnPulse(side: 'left' | 'right' = 'left') {
  if (isXMonitorOpen()) {
    closeXMonitor();
    return;
  }
  openXMonitorOnPulse(side);
}

/** Peel embedded rail off into a draggable floating panel. */
export function detachXMonitorToFloat(anchor?: DOMRect | null) {
  usePulseTwitterRailStore.getState().setSide('hidden');

  const ui = useUIStore.getState();
  ui.setAlertRulesModalOpen(false);
  ui.setAlertRulesDocked(false);
  ui.setAlertRulesPopout(null);

  const peek = useTokenDockPeekStore.getState();
  peek.setXMonitorDockSnap(null);
  if (anchor && anchor.width > 8 && anchor.height > 8) {
    peek.setDockXMonitorPosition({ x: anchor.left, y: anchor.top });
    peek.setXMonitorPanelSize({
      width: Math.round(anchor.width),
      height: Math.round(anchor.height),
    });
  }
  peek.setXMonitorPeekOpen(true);
}
