'use client';

import type { ColumnPresetSharePayload } from '@/lib/tokens/columnPresetModel';
import { cn } from '@/lib/utils/cn';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { useTokenDockPeekStore } from '@/store/tokenDockPeek';
import { useUIStore } from '@/store/ui';
import { PulseColumn } from './PulseColumn';
import { PulseAlertsAside } from './PulseAlertsAside';

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
  const floatOpen = useTokenDockPeekStore((s) => s.xMonitorPeekOpen);
  const showRail = side !== 'hidden';
  const activeChain = useUIStore((s) => s.activeChain);

  const columnStrip = (
    <>
      <PulseColumn key={`new-${activeChain}`} column="new" initialShare={initialNew} />
      <PulseColumn key={`stretch-${activeChain}`} column="stretch" initialShare={initialStretch} />
      <PulseColumn key={`migrated-${activeChain}`} column="migrated" initialShare={initialMigrated} />
    </>
  );

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-0 px-0 pb-0 pt-0 sm:px-0 xl:flex-row xl:flex-nowrap xl:items-stretch xl:gap-2',
      )}
    >
      {showRail && side === 'left' && !floatOpen ? (
        <aside className="flex h-full min-h-0 w-full shrink-0 flex-col self-stretch overflow-hidden xl:w-[min(380px,30vw)] xl:max-w-[420px]">
          <PulseAlertsAside dock="left" />
        </aside>
      ) : null}

      <div
        data-onboarding="pulse-feed"
        className={cn(
          'pulse-columns flex h-full min-h-0 flex-1 min-w-0 flex-col px-2 sm:px-3 lg:px-4 xl:flex-row xl:flex-nowrap xl:items-stretch xl:px-2',
        )}
      >
        {columnStrip}
      </div>

      {showRail && side === 'right' && !floatOpen ? (
        <aside className="flex h-full min-h-0 w-full shrink-0 flex-col self-stretch overflow-hidden xl:w-[min(380px,30vw)] xl:max-w-[420px]">
          <PulseAlertsAside dock="right" />
        </aside>
      ) : null}
    </div>
  );
}
