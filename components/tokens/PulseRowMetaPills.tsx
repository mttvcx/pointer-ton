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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {devSold ? (
        <PulseRichHover panel={<DevFundedHoverPanel bundle={bundle} />}>
          <span
            className="inline-flex h-4 cursor-default items-center gap-0.5 rounded border-0 bg-signal-bear/10 px-1.5 text-[10px] font-medium uppercase tracking-wide text-signal-bear"
            title="Developer holding - hover for funding snapshot"
          >
            <ChefHat className="h-2.5 w-2.5 shrink-0" strokeWidth={2.25} aria-hidden />
            DS
            <span className="text-[10px] font-medium normal-case">
              {Math.round(devPct!)}%
            </span>
          </span>
        </PulseRichHover>
      ) : null}
      {!bond.migrated && bond.fillPct != null ? (
        <span
          className="inline-flex h-4 items-center rounded border-0 bg-signal-bull/10 px-1.5 text-[10px] font-medium uppercase tracking-wide text-signal-bull"
          title="Bonding curve progress"
        >
          Bonding {Math.round(bond.fillPct)}%
        </span>
      ) : null}
    </div>
  );
}
