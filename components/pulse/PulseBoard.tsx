'use client';

import { useUIStore } from '@/store/ui';
import { ChainIconToggle } from '@/components/layout/ChainIconToggle';
import { PulseColumn } from '@/components/tokens/PulseColumn';
import type { ColumnPresetSharePayload } from '@/lib/tokens/columnPresetModel';
import { cn } from '@/lib/utils/cn';

export function PulseBoard({
  initialNew,
  initialStretch,
  initialMigrated,
}: {
  initialNew: ColumnPresetSharePayload | null;
  initialStretch: ColumnPresetSharePayload | null;
  initialMigrated: ColumnPresetSharePayload | null;
}) {
  const activeChain = useUIStore((s) => s.activeChain);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">
      <div
        className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5"
        style={{ borderColor: '#1b1f2a', backgroundColor: '#080d14' }}
      >
        <h1 className="text-[13px] font-semibold tracking-tight text-fg-primary">Pulse</h1>
        <ChainIconToggle size="sm" className="translate-y-px" />
        <span
          className={cn(
            'ml-auto hidden text-[10px] text-fg-muted sm:block',
            activeChain === 'ton' && 'sm:invisible',
          )}
          aria-live="polite"
        >
          Preview network · data is TON
        </span>
      </div>
      <div
        data-onboarding="pulse-feed"
        className="flex min-h-0 min-w-0 flex-1 overflow-x-hidden"
      >
        <PulseColumn column="new" initialShare={initialNew} />
        <PulseColumn column="stretch" initialShare={initialStretch} />
        <PulseColumn column="migrated" initialShare={initialMigrated} />
      </div>
    </div>
  );
}
