import { PerpsTerminalLazy } from '@/components/perps/PerpsTerminalLazy';

export default function PerpsPage() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto xl:overflow-hidden">
      <PerpsTerminalLazy />
    </div>
  );
}
