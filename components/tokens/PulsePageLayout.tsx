'use client';

import type { ColumnPresetSharePayload } from '@/lib/tokens/columnPresetModel';
import { cn } from '@/lib/utils/cn';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { PulseColumn } from './PulseColumn';
import { TwitterAlertsRail } from './TwitterAlertsRail';

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

  const columnStrip = (
    <>
      <PulseColumn column="new" initialShare={initialNew} />
      <PulseColumn column="stretch" initialShare={initialStretch} />
      <PulseColumn column="migrated" initialShare={initialMigrated} />
    </>
  );

  return (
    <div
      data-onboarding="pulse-feed"
      className={cn(
        'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-2 px-2 pb-3 pt-0 sm:px-3 sm:pt-0.5 lg:px-4 xl:flex-row xl:flex-nowrap xl:items-stretch xl:gap-3',
      )}
    >
      {showRail && side === 'left' ? (
        <aside className="flex max-h-[40vh] w-full shrink-0 flex-col overflow-hidden xl:max-h-none xl:w-[min(320px,32vw)] xl:max-w-[min(380px,38vw)]">
          <TwitterAlertsRail dock="left" />
        </aside>
      ) : null}

      <div
        className={cn(
          // Three Pulse columns share the pulse-columns helper for spacing / layout.
          'pulse-columns flex h-full min-h-0 flex-1 min-w-0 flex-col xl:flex-row xl:flex-nowrap xl:items-stretch',
        )}
      >
        {columnStrip}
      </div>

      {showRail && side === 'right' ? (
        <aside className="flex max-h-[40vh] w-full shrink-0 flex-col overflow-hidden xl:max-h-none xl:w-[min(320px,32vw)] xl:max-w-[min(380px,38vw)]">
          <TwitterAlertsRail dock="right" />
        </aside>
      ) : null}
    </div>
  );
}
