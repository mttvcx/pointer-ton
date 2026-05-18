'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CopilotStripBody } from './CopilotStripBody';
import { useCopilotMode } from './CopilotModeContext';
import { useCopilotBriefSlotVisibility } from './useCopilotBriefVisibility';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';

/**
 * Strip under the topbar. Hover briefing hides while another co-pilot surface is open.
 * Pulse alerts open from the bell as a centered modal (see AlertRulesModal).
 *
 * Per-page expanded-brief layout policy:
 *   - `/pulse`               → in-flow: the answer card pushes the columns down
 *                              so it doesn't overlap row data. (User: "BRING
 *                              IT BACK UNDER HERE WHEN EXPANDED FOR PULSE OK?")
 *   - everything else        → floating overlay: the card portals into a
 *                              `fixed` layer below the topbar, page content
 *                              stays at its default position. Squads / Track /
 *                              Portfolio / Token detail all behave this way.
 */
export function CopilotStripSlot() {
  const pathname = usePathname();
  const { mode } = useCopilotMode();
  const isEmbedded = mode === 'embedded';
  const setTopStripActive = useUIStore((s) => s.setCopilotTopStripActive);
  const { showBriefSlot } = useCopilotBriefSlotVisibility();

  const showBrief = isEmbedded && showBriefSlot;
  /** Topbar already has border-b; a strip border-t here stacks when the briefing card is open. */
  const hairlineOnlyUnderTopbar = isEmbedded && !showBrief;
  /** Pulse keeps the brief in-flow so the answer card never sits on top of token rows. */
  const inFlowBrief = Boolean(pathname?.startsWith('/pulse')) && showBrief;
  const floatingBrief = showBrief && !inFlowBrief;

  useEffect(() => {
    setTopStripActive(showBrief);
    return () => setTopStripActive(false);
  }, [showBrief, setTopStripActive]);

  useEffect(() => {
    const dm = useUIStore.getState().copilotDisplayMode;
    if (dm === 'pill') useUIStore.getState().setCopilotDisplayMode('panel');
  }, []);

  return (
    <div
      className={cn(
        'relative w-full shrink-0 bg-bg-base',
        hairlineOnlyUnderTopbar && 'border-t border-white/[0.07]',
        // In-flow brief reserves layout height (Pulse case).
        inFlowBrief && 'pb-0 pt-0 sm:pb-0',
        isEmbedded && !showBrief && 'py-0',
        !isEmbedded && 'h-2 min-h-0 overflow-hidden border-b border-border-subtle/25',
      )}
    >
      {inFlowBrief ? (
        <div className="relative z-[1] flex flex-col">
          <div className="mx-auto w-full max-w-[440px] px-3 pb-0 pt-0 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.22)_transparent]">
            <CopilotStripBody />
          </div>
        </div>
      ) : floatingBrief ? (
        <div
          className="pointer-events-none fixed inset-x-0 z-[55]"
          style={{ top: 'var(--app-topbar-h)' }}
        >
          <div className="pointer-events-auto mx-auto w-full max-w-[440px] px-3 pb-0 pt-0 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.22)_transparent]">
            <CopilotStripBody />
          </div>
        </div>
      ) : null}
    </div>
  );
}
