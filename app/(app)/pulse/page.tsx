import { PulsePageLayout } from '@/components/tokens/PulsePageLayout';
import {
  decodeColumnPresetShare,
  type ColumnPresetSharePayload,
} from '@/lib/tokens/columnPresetModel';

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
    <PulsePageLayout
      initialNew={initialNew}
      initialStretch={initialStretch}
      initialMigrated={initialMigrated}
    />
  );
}
