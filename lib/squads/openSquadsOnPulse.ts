'use client';

import { usePulseSquadsRailStore } from '@/store/pulseSquadsRail';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';

export function isSquadsRailOpen(): boolean {
  return usePulseSquadsRailStore.getState().side !== 'hidden';
}

export function closeSquadsRail() {
  usePulseSquadsRailStore.getState().setSide('hidden');
}

/** Pulse right rail — opens squads lobby beside the feed (X monitor can stay on the left). */
export function openSquadsOnPulse() {
  const twitter = usePulseTwitterRailStore.getState();
  if (twitter.side === 'right') {
    twitter.setSide('left');
  }

  usePulseSquadsRailStore.getState().setSide('right');

  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/pulse')) {
    window.location.assign('/pulse');
  }
}

export function toggleSquadsOnPulse() {
  if (isSquadsRailOpen()) {
    closeSquadsRail();
    return;
  }
  openSquadsOnPulse();
}
