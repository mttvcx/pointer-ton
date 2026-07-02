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
import { useTokenDockPeekStore } from '@/store/tokenDockPeek';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';

/**
 * Pulse workspace chrome: fixed answer slot height so columns never shift.
 * Center brief uses the full band; Pulse | Stocks + chains (left) and toolbar
 * (right) are absolutely positioned — they do not shrink or compete with the brief.
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

  // When the tracker peek is docked on the right it squeezes the toolbar — lift
  // Help + Display onto a top row to reclaim the empty band beside the panel.
  const walletPeekOpen = useTokenDockPeekStore((s) => s.walletPeekOpen);
  const walletDockSnap = useTokenDockPeekStore((s) => s.dockWalletDockSnap);
  const toolbarStacked = walletPeekOpen && walletDockSnap === 'right';

  // Same idea for the left group (Pulse/Stocks + chains): when a side dock is
  // open the centered hover-answer box collides with it, so lift the group to a
  // dedicated row above instead of squishing it under the answer box.
  const xMonitorPeekOpen = useTokenDockPeekStore((s) => s.xMonitorPeekOpen);
  const pulsePeekOpen = useTokenDockPeekStore((s) => s.pulsePeekOpen);
  const xMonitorRailOpen = usePulseTwitterRailStore((s) => s.side !== 'hidden');
  const anyDockOpen = walletPeekOpen || xMonitorPeekOpen || pulsePeekOpen || xMonitorRailOpen;

  const showBrief = isEmbedded && showBriefSlot;
  const leftStacked = showBrief && anyDockOpen;
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
          'relative flex w-full shrink-0 flex-col border-b border-white/[0.06] bg-bg-base',
          watchlistTickerOn ? 'py-1.5' : 'py-1 sm:py-1.5',
        )}
      >
        {/* Squished: lift Pulse/Stocks + chains to a dedicated row above the
            answer box so they don't overlap it. */}
        {leftStacked && hydrated ? (
          <div className="mb-1 flex w-full items-center gap-2.5 px-2 sm:gap-3 sm:px-3 lg:px-4">
            <PulseModeSelector mode={assetMode} onChange={setAssetMode} variant="label" />
            <span className="h-4 w-px shrink-0 bg-white/[0.08]" aria-hidden />
            <PulseChainSelector />
          </div>
        ) : null}

        <div className="relative w-full min-h-[var(--pulse-answer-chrome-h)]">
          {!leftStacked ? (
            <div
              className={cn(
                'pointer-events-none absolute bottom-2.5 z-10',
                'left-[max(0.5rem,var(--pulse-dock-pad-left,0px),var(--wallet-dock-pad-left,0px),var(--x-monitor-dock-pad-left,0px),var(--squads-dock-pad-left,0px))]',
              )}
            >
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
          ) : null}

          <div
            className={cn(
              'pointer-events-none absolute bottom-2.5 z-10',
              'right-[max(0.5rem,var(--pulse-dock-pad-right,0px),var(--wallet-dock-pad-right,0px),var(--x-monitor-dock-pad-right,0px),var(--squads-dock-pad-right,0px))]',
            )}
          >
            <div className="pointer-events-auto pr-2 sm:pr-3 lg:pr-4">
              <PulseWorkspaceToolbar stacked={toolbarStacked} />
            </div>
          </div>

          {/* Viewport-centered brief — dock body pad must not shift the hover answer slot. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-2.5 z-[5] flex justify-center px-2 sm:px-3 lg:px-4">
            <div
              className="pointer-events-auto h-[var(--pulse-answer-chrome-h)] w-full max-w-[440px] shrink-0"
              aria-hidden={!showBrief}
            >
              {showBrief ? <CopilotStripBody variant="pulse" className="h-full" /> : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
