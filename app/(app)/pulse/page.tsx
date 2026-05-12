import { PulseColumn } from '@/components/tokens/PulseColumn';
import {
  decodeColumnPresetShare,
  type ColumnPresetSharePayload,
} from '@/lib/tokens/columnPresetModel';

export const metadata = {
  title: 'Pulse',
};

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
      className="flex w-full min-w-0 flex-1 flex-col gap-0 xl:flex-row xl:flex-nowrap xl:items-start"
    >
      <PulseColumn column="new" initialShare={initialNew} />
      <PulseColumn column="stretch" initialShare={initialStretch} />
      <PulseColumn column="migrated" initialShare={initialMigrated} />
    </div>
  );
}
