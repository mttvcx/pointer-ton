import { TrackWorkspaceClient } from './TrackWorkspaceClient';

export default function TrackPage() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg-base px-2 py-2 pb-[calc(var(--app-bottombar-h)+8px)] sm:px-3">
      <TrackWorkspaceClient />
    </div>
  );
}
