'use client';

import { type ReactNode } from 'react';
import { ChefHat } from 'lucide-react';
import { getPulseBondingRingState } from '@/lib/tokens/bondingProgress';
import type { PulseTokenBundle } from '@/types/tokens';
import { PulseRichHover, DevFundedHoverPanel } from '@/components/tokens/PulseRichPopovers';
import { formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';

const pillBase =
  'inline-flex h-[17px] shrink-0 items-center gap-0.5 rounded-md border px-1.5 text-[10px] font-semibold tabular-nums leading-none';

const pillGreen = cn(
  pillBase,
  'border-emerald-400/45 bg-emerald-500/[0.06] text-emerald-200/95',
);

const pillBlue = cn(pillBase, 'border-sky-400/40 bg-sky-500/[0.06] text-sky-200/95');

/**
 * Bottom metrics strip (Axiom-style capsules): dev %, top-10 %, bonding, holders.
 * `minimal` keeps legacy sparse behavior; `strip` always lays out the full row when any field exists.
 */
export function PulseRowMetaPills({
  bundle,
  variant = 'minimal',
}: {
  bundle: PulseTokenBundle;
  variant?: 'minimal' | 'strip';
}) {
  const snapshot = bundle.snapshot;
  const devPct = snapshot?.dev_holding_pct;
  const top10 = snapshot?.top10_holder_pct;
  const holders = snapshot?.holder_count;
  const bond = getPulseBondingRingState(bundle);

  const devSold = devPct != null && devPct <= 5;

  if (variant === 'minimal') {
    if (!devSold && (bond.migrated || bond.fillPct == null)) return null;

    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {devSold ? (
          <PulseRichHover panel={<DevFundedHoverPanel bundle={bundle} />}>
            <span
              className={cn(
                pillBase,
                'cursor-default border-rose-400/40 bg-rose-500/[0.08] text-rose-200/95',
              )}
              title="Developer holding — hover for funding snapshot"
            >
              <ChefHat className="h-2.5 w-2.5 shrink-0" strokeWidth={2.25} aria-hidden />
              DS
              <span className="text-[10px] font-semibold normal-case tabular-nums">
                {Math.round(devPct!)}%
              </span>
            </span>
          </PulseRichHover>
        ) : null}
        {!bond.migrated && bond.fillPct != null ? (
          <span className={pillGreen} title="Bonding curve progress">
            BC {Math.round(bond.fillPct)}%
          </span>
        ) : null}
      </div>
    );
  }

  const nodes: ReactNode[] = [];

  if (devPct != null && Number.isFinite(devPct)) {
    const rounded = Math.round(devPct);
    const devCls = cn(
      pillBase,
      devSold
        ? 'cursor-default border-rose-400/40 bg-rose-500/[0.08] text-rose-200/95'
        : pillGreen,
    );
    const devTitle = devSold
      ? 'Developer holding — hover for funding snapshot'
      : 'Developer holding %';
    nodes.push(
      devSold ? (
        <PulseRichHover key="dev" panel={<DevFundedHoverPanel bundle={bundle} />}>
          <span className={devCls} title={devTitle}>
            <ChefHat className="h-2.5 w-2.5 shrink-0 opacity-90" strokeWidth={2.25} aria-hidden />
            <span className="tabular-nums">{rounded}%</span>
          </span>
        </PulseRichHover>
      ) : (
        <span key="dev" className={devCls} title={devTitle}>
          <ChefHat className="h-2.5 w-2.5 shrink-0 opacity-90" strokeWidth={2.25} aria-hidden />
          <span className="tabular-nums">{rounded}%</span>
        </span>
      ),
    );
  }

  if (top10 != null && Number.isFinite(top10)) {
    nodes.push(
      <span key="t10" className={pillGreen} title="Top 10 holders %">
        T10 {Math.round(top10)}%
      </span>,
    );
  }

  if (!bond.migrated && bond.fillPct != null) {
    nodes.push(
      <span key="bc" className={pillGreen} title="Bonding curve progress">
        BC {Math.round(bond.fillPct)}%
      </span>,
    );
  } else if (bond.migrated) {
    nodes.push(
      <span key="mig" className={pillBlue} title="Migrated / graduated">
        MIG
      </span>,
    );
  }

  if (holders != null && holders > 0) {
    nodes.push(
      <span key="h" className={pillGreen} title="Holder count">
        H {formatNumber(holders, { decimals: 0, compact: holders >= 1000 })}
      </span>,
    );
  }

  if (nodes.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {nodes}
    </div>
  );
}
