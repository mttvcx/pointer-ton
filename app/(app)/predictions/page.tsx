import { PredictionsDesk } from '@/components/predictions/PredictionsDesk';

export default function PredictionsPage() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-border-subtle bg-bg-raised/40 px-4 py-2 text-center text-[11px] uppercase tracking-wide text-fg-muted">
        Prediction markets are <span className="font-semibold text-amber-400">Preview</span> —
        markets and odds are read-only. Trade execution lands in a later phase.
      </div>
      <PredictionsDesk />
    </div>
  );
}
