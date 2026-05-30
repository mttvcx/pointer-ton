'use client';

import { goToPulse, isOnPulseRoute } from '@/lib/navigation/clientNavigate';
import { usePulseSquadsRailStore } from '@/store/pulseSquadsRail';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { useTokenDockPeekStore } from '@/store/tokenDockPeek';

export function isSquadsRailOpen(): boolean {
  return (
    usePulseSquadsRailStore.getState().side !== 'hidden' ||
    useTokenDockPeekStore.getState().squadsPeekOpen
  );
}

export function closeSquadsRail() {
  usePulseSquadsRailStore.getState().setSide('hidden');
  const peek = useTokenDockPeekStore.getState();
  peek.setSquadsPeekOpen(false);
  peek.setSquadsDockSnap(null);
}

/** Pulse right rail — opens squads chat beside the feed (X monitor can stay on the left). */
export function openSquadsOnPulse() {
  const peek = useTokenDockPeekStore.getState();
  peek.setSquadsPeekOpen(false);
  peek.setSquadsDockSnap(null);

  const twitter = usePulseTwitterRailStore.getState();
  if (twitter.side === 'right') {
    twitter.setSide('left');
  }

  usePulseSquadsRailStore.getState().setSide('right');

  if (!isOnPulseRoute()) {
    goToPulse();
  }
}

export function toggleSquadsOnPulse() {
  if (isSquadsRailOpen()) {
    closeSquadsRail();
    return;
  }
  openSquadsOnPulse();
}
