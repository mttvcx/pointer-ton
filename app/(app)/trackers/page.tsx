import type { Metadata } from 'next';
import { TrackersPanel } from '@/components/trackers/TrackersPanel';

export const metadata: Metadata = {
  title: 'Trackers',
};

export default function TrackersPage() {
  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-1 py-0 sm:px-2"
      style={{ backgroundColor: '#080d14' }}
    >
      <TrackersPanel className="min-h-0 flex-1" />
    </div>
  );
}
