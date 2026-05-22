import { PulseColumnSkeleton } from '@/components/tokens/PulseColumnSkeleton';

export default function PulseLoading() {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col px-0 pb-0 pt-0 sm:px-0">
      <div className="pulse-columns flex h-full min-h-0 flex-1 min-w-0 flex-col px-2 sm:px-3 lg:px-4 xl:flex-row xl:flex-nowrap xl:items-stretch xl:px-2">
        <PulseColumnSkeleton column="new" />
        <PulseColumnSkeleton column="stretch" />
        <PulseColumnSkeleton column="migrated" />
      </div>
    </div>
  );
}
