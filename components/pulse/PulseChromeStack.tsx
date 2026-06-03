'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CopilotStripBody } from '@/components/copilot/CopilotStripBody';
import { useCopilotMode } from '@/components/copilot/CopilotModeContext';
import { useCopilotBriefSlotVisibility } from '@/components/copilot/useCopilotBriefVisibility';
import { PulseChainSelector } from '@/components/pulse/PulseChainSelector';
import { PulseModeSelector } from '@/components/pulse/PulseModeSelector';
import { PulseDisplayPrefsSync } from '@/components/pulse/PulseDisplayPrefsSync';
import { PulseWorkspaceToolbar } from '@/components/pulse/PulseWorkspaceToolbar';
import { usePulseAssetModeStore } from '@/store/pulseAssetMode';
import { useWatchlistStore } from '@/store/watchlist';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';

/**
 * Pulse workspace chrome: Pulse | Stocks + chain icons (left) + hover brief
 * (top-aligned, same row). Answer slot height is fixed so columns never bob.
 */
export function PulseChromeStack() {
  const pathname = usePathname();
  const { mode } = useCopilotMode();
  const isEmbedded = mode === 'embedded';
  const setTopStripActive = useUIStore((s) => s.setCopilotTopStripActive);
  const { showBriefSlot } = useCopilotBriefSlotVisibility();
  const watchlistTickerOn = useWatchlistStore((s) => s.settings.showTicker);

  const assetMode = usePulseAssetModeStore((s) => s.mode);
  const hydrated = usePulseAssetModeStore((s) => s.hydrated);
  const setAssetMode = usePulseAssetModeStore((s) => s.setMode);
  const hydrateAssets = usePulseAssetModeStore((s) => s.hydrate);

  const showBrief = isEmbedded && showBriefSlot;
  const onPulse = Boolean(pathname?.startsWith('/pulse'));

  useEffect(() => {
    hydrateAssets();
  }, [hydrateAssets]);

  useEffect(() => {
    if (!onPulse) return;
    setTopStripActive(showBrief);
    return () => setTopStripActive(false);
  }, [onPulse, showBrief, setTopStripActive]);

  if (!onPulse) return null;

  return (
    <>
    <PulseDisplayPrefsSync />
    <div
      className={cn(
        'flex w-full shrink-0 flex-col border-b border-white/[0.06] bg-bg-base',
        'pl-[max(var(--pulse-dock-pad-left,0px),var(--wallet-dock-pad-left,0px),var(--x-monitor-dock-pad-left,0px),var(--squads-dock-pad-left,0px))]',
        'pr-[max(var(--pulse-dock-pad-right,0px),var(--wallet-dock-pad-right,0px),var(--x-monitor-dock-pad-right,0px),var(--squads-dock-pad-right,0px))]',
        watchlistTickerOn ? 'py-1.5' : 'py-1 sm:py-1.5',
      )}
    >
      <div className="relative flex w-full min-h-[var(--pulse-answer-chrome-h)] items-center px-2 sm:px-3 lg:px-4">
        <div className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2 sm:left-3 lg:left-4">
          <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-3">
            {hydrated ? (
              <>
                <PulseModeSelector mode={assetMode} onChange={setAssetMode} variant="label" />
                <span className="h-4 w-px shrink-0 bg-white/[0.08]" aria-hidden />
                <PulseChainSelector />
              </>
            ) : (
              <span className="h-5 w-40 animate-pulse rounded bg-bg-hover" aria-hidden />
            )}
          </div>
        </div>

        <div className="pointer-events-none absolute right-2 top-1/2 z-10 -translate-y-1/2 sm:right-3 lg:right-4">
          <div className="pointer-events-auto">
            <PulseWorkspaceToolbar />
          </div>
        </div>

        <div className="flex w-full justify-center">
          <div
            className="h-[var(--pulse-answer-chrome-h)] w-full max-w-[440px] shrink-0"
            aria-hidden={!showBrief}
          >
            {showBrief ? <CopilotStripBody variant="pulse" className="h-full min-h-0" /> : null}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
