'use client';

import { useEffect, useState } from 'react';
import { useCopilotMode } from '@/components/copilot/CopilotModeContext';
import { useUIStore } from '@/store/ui';

/** Matches `AICopilotPanel` — sheet layout vs docked rail. */
export function useNarrowCopilotShell() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return narrow;
}

/**
 * Hover briefing strip is shown only in `embedded` layout while no other co-pilot
 * surface (expanded rail, mobile sheet, float) is consuming the shell.
 */
export function useCopilotBriefSlotVisibility() {
  const { mode } = useCopilotMode();
  const panelOpen = useUIStore((s) => s.panelOpen);
  const panelCollapsed = useUIStore((s) => s.panelCollapsed);
  const detached = useUIStore((s) => s.copilotDetached);
  const narrow = useNarrowCopilotShell();

  const isEmbedded = mode === 'embedded';
  const dockedExpanded = panelOpen && !panelCollapsed && !narrow;
  const sheetOpen = panelOpen && narrow;
  const floatOpen = detached && panelOpen && !narrow;

  const hideHoverBrief = dockedExpanded || sheetOpen || floatOpen;

  const showBriefSlot = isEmbedded && !hideHoverBrief;

  return {
    narrow,
    isEmbedded,
    hideHoverBrief,
    showBriefSlot,
    panelOpen,
    panelCollapsed,
    detached,
  };
}
