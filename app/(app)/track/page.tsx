import type { Metadata } from 'next';

import { TrackWorkspaceClient } from './TrackWorkspaceClient';

export const metadata: Metadata = {
  title: 'Track',
};

export default function TrackPage() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#080d14] px-2 py-2 pb-[calc(var(--app-bottombar-h)+8px)]">
      <TrackWorkspaceClient />
    </div>
  );
}
