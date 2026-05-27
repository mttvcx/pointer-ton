import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type DeskHeaderSettingsProps = {
  className?: string;
  onOpen?: () => void;
};

/** Column settings gear — opens Holders Table Settings modal. */
export function DeskHeaderSettings({ className, onOpen }: DeskHeaderSettingsProps) {
  return (
    <th
      className={cn('w-8 px-1 py-1 text-right align-middle', className)}
      aria-label="Column settings"
    >
      <button
        type="button"
        className="inline-flex items-center justify-center"
        onClick={() => onOpen?.()}
        disabled={!onOpen}
        aria-label="Open holders table settings"
      >
        <Settings className="h-3 w-3 text-fg-muted/40 transition-colors hover:text-fg-primary" />
      </button>
    </th>
  );
}
