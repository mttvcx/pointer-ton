import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Helpful "no data" surface. Use everywhere instead of a bare "No data"
 * string. The icon is rendered with subtle accent tint so the empty state
 * feels intentional, not broken.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-4 py-10 text-center',
        className,
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border-subtle bg-bg-base text-accent-primary/70">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <p className="text-sm font-medium text-fg-primary">{title}</p>
      {description ? (
        <p className="max-w-xs text-[11px] leading-relaxed text-fg-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
