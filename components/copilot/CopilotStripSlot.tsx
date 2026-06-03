'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CopilotStripBody } from './CopilotStripBody';
import { useCopilotMode } from './CopilotModeContext';
import { useCopilotBriefSlotVisibility } from './useCopilotBriefVisibility';
import { useUIStore } from '@/store/ui';

/** Hover briefing — `/pulse` uses `PulseChromeStack`; other routes float below topbar. */
export function CopilotStripSlot() {
  const pathname = usePathname();
  const { mode } = useCopilotMode();
  const isEmbedded = mode === 'embedded';
  const setTopStripActive = useUIStore((s) => s.setCopilotTopStripActive);
  const { showBriefSlot } = useCopilotBriefSlotVisibility();

  const showBrief = isEmbedded && showBriefSlot;
  const onPulse = Boolean(pathname?.startsWith('/pulse'));

  useEffect(() => {
    if (onPulse) return;
    setTopStripActive(showBrief);
    return () => setTopStripActive(false);
  }, [onPulse, showBrief, setTopStripActive]);

  useEffect(() => {
    const dm = useUIStore.getState().copilotDisplayMode;
    if (dm === 'pill') useUIStore.getState().setCopilotDisplayMode('panel');
  }, []);

  if (onPulse || !showBrief) return null;

  return (
    <div className="relative h-0 w-full shrink-0 overflow-visible">
      <div
        className="pointer-events-none fixed inset-x-0 z-[55]"
        style={{ top: 'var(--app-topbar-h)' }}
      >
        <div className="pointer-events-auto mx-auto w-full max-w-[440px] px-3 pb-0 pt-0 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.22)_transparent]">
          <CopilotStripBody />
        </div>
      </div>
    </div>
  );
}
