'use client';

import { goToPulse, isOnPulseRoute, isOnTokenRoute } from '@/lib/navigation/clientNavigate';
import { useTokenDockPeekStore } from '@/store/tokenDockPeek';
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

  if (isOnPulseRoute()) {
    usePulseTwitterRailStore.getState().setSide(side);
    return;
  }

  if (isOnTokenRoute()) {
    usePulseTwitterRailStore.getState().setSide('hidden');
    peek.setXMonitorPeekOpen(true);
    return;
  }

  usePulseTwitterRailStore.getState().setSide(side);
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
