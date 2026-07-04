'use client';

import { goToPulse, isOnPulseRoute, isOnTokenRoute } from '@/lib/navigation/clientNavigate';
import { pickFreeDockSide, useTokenDockPeekStore } from '@/store/tokenDockPeek';
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
  peek.setXMonitorPeekOpen(false);
  peek.setXMonitorDockSnap(null);
}

/** Pulse side rail — closes duplicate popouts/floats. */
export function openXMonitorOnPulse(side: 'left' | 'right' = 'left') {
  const peek = useTokenDockPeekStore.getState();
  peek.setXMonitorPeekOpen(false);
  peek.setXMonitorDockSnap(null);

  const ui = useUIStore.getState();
  ui.setAlertRulesModalOpen(false);
  ui.setAlertRulesDocked(false);
  ui.setAlertRulesPopout(null);

  // Always open the draggable/resizable floating dock (like the wallet tracker),
  // docked to a FREE side so it stands full-height + pushes content over without
  // spawning on top of another already-docked panel (wallet/squads/pulse).
  usePulseTwitterRailStore.getState().setSide('hidden');
  peek.setXMonitorPeekOpen(true);
  peek.setXMonitorDockSnap(pickFreeDockSide('xMonitor') ?? side);

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
