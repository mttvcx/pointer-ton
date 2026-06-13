import { PerpsTerminalLazy } from '@/components/perps/PerpsTerminalLazy';

export default function PerpsPage() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto xl:overflow-hidden">
      <div className="border-b border-border-subtle bg-bg-raised/40 px-4 py-2 text-center text-[11px] uppercase tracking-wide text-fg-muted">
        Perps execution is currently <span className="font-semibold text-amber-400">Preview</span> —
        markets, quotes, and charts are read-only. Order submission is disabled until Hyperliquid
        order signing ships.
      </div>
      <PerpsTerminalLazy />
    </div>
  );
}
