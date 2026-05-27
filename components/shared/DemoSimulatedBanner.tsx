import { cn } from '@/lib/utils/cn';

/** Non-blocking banner for simulated product areas (Perps, Squads sample data, etc.). */
export function DemoSimulatedBanner({
  title,
  detail,
  className,
}: {
  title: string;
  detail: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        'shrink-0 border-b border-amber-500/25 bg-amber-500/[0.08] px-3 py-2 text-center',
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-200/95">
        {title}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-amber-100/70">{detail}</p>
    </div>
  );
}
