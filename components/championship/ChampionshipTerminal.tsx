'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChampionshipHero } from '@/components/championship/ChampionshipHero';
import { ChampionshipTabs } from '@/components/championship/ChampionshipTabs';
import { SoloLeaderboardArena } from '@/components/championship/SoloLeaderboardArena';
import { SquadLeaderboardArena } from '@/components/championship/SquadLeaderboardArena';
import { WorldCupPanel } from '@/components/championship/WorldCupPanel';
import { RulesPanel } from '@/components/championship/RulesPanel';
import { CHAMPIONSHIP_REGIONS } from '@/lib/championship/config';
import { emptyChampionshipBundle, getDemoChampionshipBundle } from '@/lib/championship/mockData';
import type { ChampionshipRegion, ChampionshipTab } from '@/lib/championship/types';
import { getActiveEvent, readStoredRegion, storeRegion } from '@/lib/championship/time';
import { useChampionshipDemoMode } from '@/lib/hooks/useChampionshipDemoMode';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { cn } from '@/lib/utils/cn';
import { X } from 'lucide-react';
import { toast } from 'sonner';

const ARENA_TABS: ChampionshipTab[] = ['overview', 'solo', 'squads'];
const PTCS_REGION_PROMPT_KEY = 'pointer-ptcs-region-prompted';

export function ChampionshipTerminal() {
  const demoMode = useChampionshipDemoMode();
  const { user, authenticated } = usePointerAuth();
  const [tab, setTab] = useState<ChampionshipTab>('overview');
  const [region, setRegion] = useState<ChampionshipRegion>('global');
  const [regionReady, setRegionReady] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const stored = readStoredRegion();
    if (stored) {
      setRegion(stored);
      setRegionReady(true);
      return;
    }
    setRegion('global');
    setRegionReady(true);
    if (!authenticated) return;
    try {
      if (sessionStorage.getItem(PTCS_REGION_PROMPT_KEY)) return;
    } catch {
      /* ignore */
    }
    setShowRegionModal(true);
  }, [authenticated]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const event = useMemo(() => getActiveEvent(region, now), [region, now]);

  const bundle = useMemo(() => {
    if (demoMode) {
      return getDemoChampionshipBundle(event) ?? emptyChampionshipBundle(user?.id);
    }
    return emptyChampionshipBundle(user?.id);
  }, [demoMode, event, user?.id]);

  const viewerUserId =
    demoMode && bundle.viewerUserId ? bundle.viewerUserId : user?.id ?? null;

  const dismissRegionPrompt = useCallback(() => {
    setShowRegionModal(false);
    try {
      sessionStorage.setItem(PTCS_REGION_PROMPT_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const handleRegionChange = useCallback(
    (next: ChampionshipRegion) => {
      setRegion(next);
      storeRegion(next);
      dismissRegionPrompt();
      toast.success(`${CHAMPIONSHIP_REGIONS[next].shortLabel} region selected`);
    },
    [dismissRegionPrompt],
  );

  const emptyLiveCopy =
    'No records for this cup yet. Realized closes during the live window will populate rankings.';

  const isArenaTab = ARENA_TABS.includes(tab);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-base shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <ChampionshipHero event={event} region={region} onRegionChange={handleRegionChange} now={now} />
      <ChampionshipTabs active={tab} onChange={setTab} />

      <div
        className={cn(
          'min-h-0 flex-1 px-2 py-2 sm:px-4 sm:py-3',
          isArenaTab ? 'flex flex-col overflow-hidden' : 'overflow-y-auto overflow-x-hidden',
        )}
      >
        {!regionReady ? (
          <p className="text-sm text-fg-muted">Loading…</p>
        ) : (
          <>
            {tab === 'overview' || tab === 'solo' ? (
              <SoloLeaderboardArena
                entries={bundle.solo}
                viewerUserId={viewerUserId}
                emptyMessage={demoMode ? undefined : emptyLiveCopy}
                focus={tab === 'overview' ? 'viewer' : 'leader'}
              />
            ) : null}

            {tab === 'squads' ? (
              <SquadLeaderboardArena
                entries={bundle.squads}
                emptyMessage={demoMode ? undefined : emptyLiveCopy}
                squadActionsDisabled
                onCreateSquad={() => toast.message('Squad creation opens in a later private-beta drop')}
                onJoinSquad={() => toast.message('Squad join opens in a later private-beta drop')}
              />
            ) : null}

            {tab === 'worldcup' ? (
              <WorldCupPanel
                standings={bundle.worldCup}
                lastWeekQualifiers={bundle.lastWeekQualifiers}
              />
            ) : null}

            {tab === 'rules' ? <RulesPanel /> : null}
          </>
        )}
      </div>

      {showRegionModal ? (
        <RegionModal
          onSelect={handleRegionChange}
          onClose={() => {
            dismissRegionPrompt();
          }}
        />
      ) : null}
    </div>
  );
}

function RegionModal({
  onSelect,
  onClose,
}: {
  onSelect: (r: ChampionshipRegion) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-labelledby="ptcs-region-title"
        className="relative w-full max-w-md rounded-md border border-border-subtle bg-bg-raised p-5 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="btn-press absolute right-3 top-3 rounded-sm p-1 text-fg-muted hover:text-fg-secondary"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 id="ptcs-region-title" className="text-base font-semibold text-fg-primary">
          Pick your PTCS region
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-secondary">
          Weekly cups run Monday through Sunday in your region&apos;s time zone.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(Object.keys(CHAMPIONSHIP_REGIONS) as ChampionshipRegion[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={cn(
                'btn-press rounded-sm border border-border-subtle bg-bg-base px-3 py-3 text-left',
                'hover:border-accent-primary/40 hover:bg-accent-primary/10',
              )}
            >
              <span className="block text-sm font-semibold text-fg-primary">
                {CHAMPIONSHIP_REGIONS[key].label}
              </span>
              <span className="mt-0.5 block text-[11px] text-fg-muted">
                {CHAMPIONSHIP_REGIONS[key].timeZone}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
