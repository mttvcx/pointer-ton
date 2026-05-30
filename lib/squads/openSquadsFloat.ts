'use client';

import { useTokenDockPeekStore, DEFAULT_SQUADS_PEEK_SIZE } from '@/store/tokenDockPeek';
import { usePulseSquadsRailStore } from '@/store/pulseSquadsRail';
import { openSquadsOnPulse } from '@/lib/squads/openSquadsOnPulse';

/** Peel embedded squads rail into a draggable floating panel. */
export function detachSquadsToFloat(anchor?: DOMRect | null) {
  usePulseSquadsRailStore.getState().setSide('hidden');

  const peek = useTokenDockPeekStore.getState();
  peek.setSquadsDockSnap(null);
  if (anchor && anchor.width > 8 && anchor.height > 8) {
    peek.setDockSquadsPosition({ x: anchor.left, y: anchor.top });
    // Rail is full viewport height — float should start compact, not stuck expanded.
    peek.setSquadsPanelSize({
      width: Math.round(Math.min(420, Math.max(300, anchor.width))),
      height: Math.round(
        Math.min(DEFAULT_SQUADS_PEEK_SIZE.height, 520, anchor.height * 0.65),
      ),
    });
  }
  peek.setSquadsPeekOpen(true);
}

/** Dock floating squads back into the Pulse right rail. */
export function embedSquadsOnPulse() {
  const peek = useTokenDockPeekStore.getState();
  peek.setSquadsPeekOpen(false);
  peek.setSquadsDockSnap(null);
  openSquadsOnPulse();
}
