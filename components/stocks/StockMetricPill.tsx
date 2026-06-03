import { cn } from '@/lib/utils/cn';

export function StockMetricPill({
  label,
  value,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'bull' | 'bear';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm bg-bg-base/60 px-1.5 py-0.5 text-[10px] tabular-nums',
        className,
      )}
    >
      <span className="font-medium uppercase tracking-wide text-fg-muted">{label}</span>
      <span
        className={cn(
          'font-semibold',
          tone === 'bull' && 'text-signal-bull',
          tone === 'bear' && 'text-signal-bear',
          tone === 'neutral' && 'text-fg-secondary',
        )}
      >
        {value}
      </span>
    </span>
  );
}
