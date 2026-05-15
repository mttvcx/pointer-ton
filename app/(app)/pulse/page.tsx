import { PulseColumn } from '@/components/tokens/PulseColumn';
import {
  decodeColumnPresetShare,
  type ColumnPresetSharePayload,
} from '@/lib/tokens/columnPresetModel';
import { cn } from '@/lib/utils/cn';

export default async function PulsePage({
  searchParams,
}: {
  searchParams: Promise<{ col?: string; cs?: string }>;
}) {
  const sp = await searchParams;
  let initialNew: ColumnPresetSharePayload | null = null;
  let initialStretch: ColumnPresetSharePayload | null = null;
  let initialMigrated: ColumnPresetSharePayload | null = null;
  if (
    sp.cs &&
    (sp.col === 'new' || sp.col === 'stretch' || sp.col === 'migrated')
  ) {
    const decoded = decodeColumnPresetShare(sp.cs);
    if (decoded && decoded.column_id === sp.col) {
      if (sp.col === 'new') initialNew = decoded;
      if (sp.col === 'stretch') initialStretch = decoded;
      if (sp.col === 'migrated') initialMigrated = decoded;
    }
  }

  return (
    <div
      data-onboarding="pulse-feed"
      className={cn(
        // `pulse-columns` is the hook the Display preference uses to set
        // horizontal gap between the three columns (compact/default/spaced).
        // h-full + min-h-0 anchors the inner columns to the available height
        // so each column can scroll independently inside its bounded box.
        // px-* gives both screen edges breathing room so V/MC numbers
        // never sit flush against the viewport edge.
        'pulse-columns flex h-full min-h-0 w-full min-w-0 flex-1 flex-col px-2 sm:px-3 lg:px-4',
        'xl:flex-row xl:flex-nowrap xl:items-stretch',
      )}
    >
      <PulseColumn column="new" initialShare={initialNew} />
      <PulseColumn column="stretch" initialShare={initialStretch} />
      <PulseColumn column="migrated" initialShare={initialMigrated} />
    </div>
  );
}
