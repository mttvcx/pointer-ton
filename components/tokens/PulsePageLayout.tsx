'use client';

import type { ColumnPresetSharePayload } from '@/lib/tokens/columnPresetModel';
import { cn } from '@/lib/utils/cn';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { PulseColumn } from './PulseColumn';
import { PulseAlertsAside } from './PulseAlertsAside';
import { PulseSquadsAside } from './PulseSquadsAside';
import { usePulseSquadsRailStore } from '@/store/pulseSquadsRail';
import { StocksPulseBoard } from '@/components/stocks/StocksPulseBoard';
import { usePulseAssetModeStore } from '@/store/pulseAssetMode';
import { usePulseDisplayPrefsStore } from '@/store/pulseDisplayPrefs';
import type { PulseColumnId } from '@/lib/utils/constants';

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

  const columnStrip =
    mode === 'stocks' ? (
      <StocksPulseBoard />
    ) : (
      <>
        {(
          [
            ['new', initialNew],
            ['stretch', initialStretch],
            ['migrated', initialMigrated],
          ] as const
        ).map(([col, share]) =>
          visibleColumns[col as PulseColumnId] ? (
            <PulseColumn key={col} column={col} initialShare={share} />
          ) : null,
        )}
      </>
    );

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-0 px-0 pb-0 pt-0 sm:px-0 xl:flex-row xl:flex-nowrap xl:items-stretch xl:gap-2',
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
          'pulse-columns -mt-0.5 flex h-full min-h-0 flex-1 min-w-0 flex-col px-2 sm:px-3 lg:px-4 xl:flex-row xl:flex-nowrap xl:items-stretch xl:px-2',
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
