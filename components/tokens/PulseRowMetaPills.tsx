'use client';

import { ChefHat } from 'lucide-react';
import { getPulseBondingRingState } from '@/lib/tokens/bondingProgress';
import type { PulseTokenBundle } from '@/types/tokens';
import { PulseRichHover, DevFundedHoverPanel } from '@/components/tokens/PulseRichPopovers';

/** Compact status row: dev-sold heuristic + bonding (Axiom-style capsules). */
export function PulseRowMetaPills({ bundle }: { bundle: PulseTokenBundle }) {
  const snapshot = bundle.snapshot;
  const devPct = snapshot?.dev_holding_pct;
  const bond = getPulseBondingRingState(bundle);

  const devSold = devPct != null && devPct <= 5;

  if (!devSold && (bond.migrated || bond.fillPct == null)) return null;

  return (
    <div className="mt-1 flex flex-nowrap items-center gap-1 overflow-hidden">
      {devSold ? (
        <PulseRichHover panel={<DevFundedHoverPanel bundle={bundle} />}>
          <span
            className="inline-flex cursor-default items-center gap-0.5 rounded-md border border-rose-500/35 bg-rose-500/[0.11] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-rose-100/95"
            title="Developer holding - hover for funding snapshot"
          >
            <ChefHat className="h-2.5 w-2.5 shrink-0" strokeWidth={2.25} aria-hidden />
            DS
            <span className="tabular-nums text-[9px] font-semibold tabular-nums normal-case">
              {Math.round(devPct!)}%
            </span>
          </span>
        </PulseRichHover>
      ) : null}
      {!bond.migrated && bond.fillPct != null ? (
        <span
          className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/[0.1] px-1.5 py-0.5 text-[9px] font-semibold text-emerald-100/90"
          title="Bonding curve progress"
        >
          Bonding {Math.round(bond.fillPct)}%
        </span>
      ) : null}
    </div>
  );
}
