import { PulseRowSkeleton } from '@/components/shared/Skeleton';
import { PULSE_COLUMN_ACCENT_DOT, type PulseColumnId } from '@/lib/utils/constants';
import { cn } from '@/lib/utils/cn';

const COLUMN_LABEL: Record<PulseColumnId, string> = {
  new: 'New',
  stretch: 'Stretch',
  migrated: 'Migrated',
};

/** Column shell + row skeletons — used by Suspense fallbacks and route loading.tsx. */
export function PulseColumnSkeleton({ column }: { column: PulseColumnId }) {
  const dotClass = PULSE_COLUMN_ACCENT_DOT[column];
  const title = COLUMN_LABEL[column];

  return (
    <section
      className={cn(
        'pulse-column flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-t-0 border-border-subtle bg-bg-raised',
      )}
      aria-busy
      aria-label={`Loading ${title} column`}
    >
      <header className="sticky top-0 z-[40] shrink-0 border-b border-white/[0.1] bg-bg-hover px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClass)} aria-hidden />
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-fg-primary">{title}</h2>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden bg-bg-raised px-1.5 py-1">
        {Array.from({ length: 8 }, (_, i) => (
          <PulseRowSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}
