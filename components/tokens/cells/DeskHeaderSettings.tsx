import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type DeskHeaderSettingsProps = {
  className?: string;
};

/** Placeholder column-toggle gear — wired later. */
export function DeskHeaderSettings({ className }: DeskHeaderSettingsProps) {
  return (
    <th
      className={cn('w-8 px-1 py-2 text-right align-middle', className)}
      aria-label="Column settings"
    >
      <button
        type="button"
        className="inline-flex items-center justify-center"
        onClick={() => {
          /* column toggle menu */
        }}
      >
        <Settings className="h-3 w-3 text-fg-muted/40 transition-colors hover:text-fg-primary" />
      </button>
    </th>
  );
}
