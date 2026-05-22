import type { AutoSellTrigger } from '@/lib/autoSell/types';

export type PositionEvalInput = {
  mint: string;
  symbol: string | null;
  costBasisUsd: number;
  unrealizedPnlUsd: number | null;
  marketCapUsd: number | null;
  /** When we first observed a non-zero balance for this mint (ms). */
  positionOpenedAtMs: number | null;
};

export function gainPctFromPosition(p: PositionEvalInput): number | null {
  if (p.costBasisUsd <= 0 || p.unrealizedPnlUsd == null) return null;
  return (p.unrealizedPnlUsd / p.costBasisUsd) * 100;
}

export function evaluateAutoSellTrigger(
  trigger: AutoSellTrigger,
  p: PositionEvalInput,
  nowMs = Date.now(),
): boolean {
  switch (trigger.type) {
    case 'mc_milestone': {
      const mc = p.marketCapUsd;
      return mc != null && Number.isFinite(mc) && mc >= trigger.targetMcUsd;
    }
    case 'stop_loss_mc': {
      const mc = p.marketCapUsd;
      return mc != null && Number.isFinite(mc) && mc <= trigger.mcUsd;
    }
    case 'pct_gain': {
      const gain = gainPctFromPosition(p);
      return gain != null && gain >= trigger.gainPct;
    }
    case 'time_elapsed': {
      if (p.positionOpenedAtMs == null) return false;
      return nowMs - p.positionOpenedAtMs >= trigger.minutes * 60_000;
    }
    default:
      return false;
  }
}

export function triggerSummary(trigger: AutoSellTrigger): string {
  switch (trigger.type) {
    case 'mc_milestone':
      return `MC ≥ $${formatCompact(trigger.targetMcUsd)}`;
    case 'stop_loss_mc':
      return `MC ≤ $${formatCompact(trigger.mcUsd)}`;
    case 'pct_gain':
      return `+${trigger.gainPct}% gain`;
    case 'time_elapsed':
      return `${trigger.minutes}m held`;
    default:
      return '—';
  }
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}
