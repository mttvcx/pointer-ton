'use client';

import { Bell, ChevronDown, ChevronUp, Square } from 'lucide-react';
import { toggleXMonitorOnPulse } from '@/lib/xMonitor/openXMonitorOnPulse';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { useTokenDockPeekStore } from '@/store/tokenDockPeek';
import { useCopilotMode } from './CopilotModeContext';
import { useCopilotBriefSlotVisibility } from './useCopilotBriefVisibility';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';

/**
 * Level 1 — minimal centered pill: Pointer mark · Hide/Show · Side panel toggle.
 *
 * - Square: opens the docked co-pilot rail; click again to close (does not auto-expand hover briefing).
 * - Hide/Show: reflects whether the hover briefing strip is visible; if the rail is blocking it,
 *   Show closes the rail first (then stays minimized until user expands).
 */
export function CopilotTopbarSlot() {
  const { mode, setMode } = useCopilotMode();
  const setDisplayMode = useUIStore((s) => s.setCopilotDisplayMode);
  const setPanelOpen = useUIStore((s) => s.setPanelOpen);
  const setPanelCollapsed = useUIStore((s) => s.setPanelCollapsed);
  const setDetached = useUIStore((s) => s.setCopilotDetached);
  const panelOpen = useUIStore((s) => s.panelOpen);
  const xMonitorRailOpen = usePulseTwitterRailStore((s) => s.side !== 'hidden');
  const xMonitorPeekOpen = useTokenDockPeekStore((s) => s.xMonitorPeekOpen);
  const xMonitorOpen = xMonitorRailOpen || xMonitorPeekOpen;

  const { hideHoverBrief, showBriefSlot } = useCopilotBriefSlotVisibility();

  /** Hover answer rectangle is expanded (embedded + strip body mounted). */
  const briefExpanded = showBriefSlot;

  const toggleRailOrBrief = () => {
    if (hideHoverBrief) {
      setPanelOpen(false);
      setDetached(false);
      setPanelCollapsed(false);
      setMode('minimized');
      return;
    }
    if (mode !== 'embedded' && mode !== 'minimized') return;
    setMode(mode === 'minimized' ? 'embedded' : 'minimized');
  };

  const toggleSidebarPanel = () => {
    if (panelOpen) {
      setPanelOpen(false);
      setDetached(false);
      setPanelCollapsed(false);
      setMode('minimized');
      return;
    }
    setMode('sidebar');
    setDisplayMode('panel');
    setDetached(false);
    setPanelCollapsed(false);
    setPanelOpen(true);
  };

  const togglePulseAlerts = () => {
    toggleXMonitorOnPulse('left');
  };

  return (
    <div
      className={cn(
        'flex h-8 shrink-0 items-center gap-1 rounded-full border border-white/[0.1] bg-bg-sunken/92 px-1 backdrop-blur-md',
        'shadow-[0_10px_28px_-14px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.04)_inset]',
        'transition-[border-color,box-shadow] duration-150 hover:border-accent-primary/38',
        'hover:shadow-[0_14px_36px_-16px_rgba(0,0,0,0.75)]',
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-base shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-white/[0.1]">
        <img
          src="/branding/pointer-bird.png"
          alt=""
          width={22}
          height={22}
          decoding="async"
          className="h-[22px] w-[22px] object-contain"
        />
      </span>

      <button
        type="button"
        onClick={togglePulseAlerts}
        title={xMonitorOpen ? 'Close X monitor' : 'Open X monitor'}
        aria-label={xMonitorOpen ? 'Close X monitor' : 'Open X monitor'}
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors',
          'bg-bg-hover/70 text-fg-muted hover:bg-bg-hover hover:text-fg-primary',
          xMonitorOpen && 'bg-accent-primary/15 text-accent-primary ring-1 ring-accent-primary/35',
        )}
      >
        <Bell className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
      </button>

      <button
        type="button"
        onClick={toggleRailOrBrief}
        title={
          hideHoverBrief
            ? 'Rail is open — click to close it and restore top briefing (collapsed)'
            : briefExpanded
              ? 'Hide hover briefing strip'
              : 'Show hover briefing strip'
        }
        aria-expanded={briefExpanded}
        className="flex h-7 items-center gap-1 rounded-full bg-bg-hover/70 px-2.5 text-[11px] font-medium text-fg-primary transition-colors hover:bg-bg-hover"
      >
        {!briefExpanded ? (
          <>
            Show
            <ChevronUp className="h-3 w-3 opacity-80" strokeWidth={2.25} aria-hidden />
          </>
        ) : (
          <>
            Hide
            <ChevronDown className="h-3 w-3 opacity-80" strokeWidth={2.25} aria-hidden />
          </>
        )}
      </button>

      <button
        type="button"
        onClick={toggleSidebarPanel}
        title={panelOpen ? 'Close side co-pilot panel' : 'Open co-pilot in side panel'}
        aria-label={panelOpen ? 'Close co-pilot side panel' : 'Open co-pilot in side panel'}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-hover/70 text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
      >
        <Square className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
