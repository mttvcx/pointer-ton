'use client';

import { useTokenDockPeekStore, DEFAULT_SQUADS_PEEK_SIZE } from '@/store/tokenDockPeek';
import { usePulseSquadsRailStore } from '@/store/pulseSquadsRail';
import { openSquadsOnPulse } from '@/lib/squads/openSquadsOnPulse';

/** Active pointer while peeling the embedded rail into the float panel. */
export type SquadsPeelDragHandoff = {
  pointerId: number;
  clientX: number;
  clientY: number;
  origX: number;
  origY: number;
};

let squadsPeelDragHandoff: SquadsPeelDragHandoff | null = null;

export function consumeSquadsPeelDrag(): SquadsPeelDragHandoff | null {
  const handoff = squadsPeelDragHandoff;
  squadsPeelDragHandoff = null;
  return handoff;
}

type PeelPointer = {
  pointerId: number;
  clientX: number;
  clientY: number;
  button: number;
};

/** Peel embedded squads rail into a draggable floating panel. */
export function detachSquadsToFloat(anchor?: DOMRect | null, pointer?: PeelPointer) {
  usePulseSquadsRailStore.getState().setSide('hidden');

  const peek = useTokenDockPeekStore.getState();
  peek.setSquadsDockSnap(null);

  let origX = peek.dockSquadsPosition.x;
  let origY = peek.dockSquadsPosition.y;

  if (anchor && anchor.width > 8 && anchor.height > 8) {
    origX = anchor.left;
    origY = anchor.top;
    peek.setDockSquadsPosition({ x: origX, y: origY });
    // Rail is full viewport height — float should start compact, not stuck expanded.
    peek.setSquadsPanelSize({
      width: Math.round(Math.min(420, Math.max(300, anchor.width))),
      height: Math.round(
        Math.min(DEFAULT_SQUADS_PEEK_SIZE.height, 520, anchor.height * 0.65),
      ),
    });
  }

  if (pointer && pointer.button === 0) {
    squadsPeelDragHandoff = {
      pointerId: pointer.pointerId,
      clientX: pointer.clientX,
      clientY: pointer.clientY,
      origX,
      origY,
    };
  } else {
    squadsPeelDragHandoff = null;
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
