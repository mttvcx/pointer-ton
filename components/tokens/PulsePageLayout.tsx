'use client';

import { useState } from 'react';
import type { ColumnPresetSharePayload } from '@/lib/tokens/columnPresetModel';
import { cn } from '@/lib/utils/cn';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { PulseColumn } from './PulseColumn';
import { PulseAlertsAside } from './PulseAlertsAside';
import { PulseSquadsAside } from './PulseSquadsAside';
import { usePulseSquadsRailStore } from '@/store/pulseSquadsRail';
import { StocksPulseBoard } from '@/components/stocks/StocksPulseBoard';
import { usePulseAssetModeStore } from '@/store/pulseAssetMode';
import { usePulseDisplayPrefsStore } from '@/store/pulseDisplayPrefs';
import type { PulseColumnId } from '@/lib/utils/constants';

const MOBILE_COL_LABEL: Record<PulseColumnId, string> = {
  new: 'New',
  stretch: 'Stretch',
  migrated: 'Migrated',
};

export function PulsePageLayout({
  initialNew,
  initialStretch,
  initialMigrated,
}: {
  initialNew: ColumnPresetSharePayload | null;
  initialStretch: ColumnPresetSharePayload | null;
  initialMigrated: ColumnPresetSharePayload | null;
}) {
  const side = usePulseTwitterRailStore((s) => s.side);
  const showRail = side !== 'hidden';
  const squadsSide = usePulseSquadsRailStore((s) => s.side);
  const showSquadsRail = squadsSide !== 'hidden';
  const mode = usePulseAssetModeStore((s) => s.mode);
  const visibleColumns = usePulseDisplayPrefsStore((s) => s.visibleColumns);
  const isMobile = useIsMobile();
  const [mobileCol, setMobileCol] = useState<PulseColumnId>('new');

  const cols = [
    ['new', initialNew],
    ['stretch', initialStretch],
    ['migrated', initialMigrated],
  ] as const;

  const columnStrip =
    mode === 'stocks' ? (
      <StocksPulseBoard />
    ) : isMobile ? (
      // Mobile: one full-width column at a time + a New/Stretch/Migrated switcher.
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-1.5">
        <div className="flex shrink-0 items-stretch gap-1 px-0.5">
          {cols.map(([col]) =>
            visibleColumns[col] ? (
              <button
                key={col}
                type="button"
                onClick={() => setMobileCol(col)}
                className={cn(
                  'flex-1 rounded-md px-3 py-2 text-[13px] font-semibold transition',
                  mobileCol === col
                    ? 'bg-accent-primary/15 text-accent-primary'
                    : 'bg-bg-hover/40 text-fg-muted hover:text-fg-secondary',
                )}
              >
                {MOBILE_COL_LABEL[col]}
              </button>
            ) : null,
          )}
        </div>
        {(() => {
          const active = cols.find(([c]) => c === mobileCol) ?? cols[0];
          const [col, share] = active;
          return visibleColumns[col] ? (
            <PulseColumn key={col} column={col} initialShare={share} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-[12px] text-fg-muted">
              Column hidden in Display settings.
            </div>
          );
        })()}
      </div>
    ) : (
      <>
        {cols.map(([col, share]) =>
          visibleColumns[col as PulseColumnId] ? (
            <PulseColumn key={col} column={col} initialShare={share} />
          ) : null,
        )}
      </>
    );

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-0 px-0 pb-0 pt-0 sm:px-0',
        'xl:flex-row xl:flex-nowrap xl:items-stretch xl:gap-2 xl:min-h-full',
      )}
    >
      {showRail && side === 'left' ? (
        <aside className="flex h-full min-h-0 w-full shrink-0 flex-col self-stretch overflow-hidden xl:w-[min(380px,30vw)] xl:max-w-[420px]">
          <PulseAlertsAside dock="left" />
        </aside>
      ) : null}

      <div
        data-onboarding="pulse-feed"
        className={cn(
          'pulse-columns -mt-0.5 flex h-full min-h-0 flex-1 min-w-0 flex-col px-2 sm:px-3 lg:px-4',
          'xl:flex-row xl:flex-nowrap xl:items-stretch xl:self-stretch xl:px-2',
        )}
      >
        {columnStrip}
      </div>

      {showRail && side === 'right' && !showSquadsRail ? (
        <aside className="flex h-full min-h-0 w-full shrink-0 flex-col self-stretch overflow-hidden xl:w-[min(380px,30vw)] xl:max-w-[420px]">
          <PulseAlertsAside dock="right" />
        </aside>
      ) : null}

      {showSquadsRail && squadsSide === 'right' ? (
        <aside className="flex h-full min-h-0 w-full shrink-0 flex-col self-stretch overflow-hidden xl:w-[min(380px,30vw)] xl:max-w-[420px]">
          <PulseSquadsAside dock="right" />
        </aside>
      ) : null}
    </div>
  );
}
