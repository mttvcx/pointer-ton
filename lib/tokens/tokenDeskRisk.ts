import { cn } from '@/lib/utils/cn';

export type LiquidityRiskTier = 'missing' | 'healthy' | 'low' | 'critical';

/** Classify liquidity USD for header / desk risk coloring. */
export function liquidityRiskTier(usd: number | null | undefined): LiquidityRiskTier {
  if (usd == null || !Number.isFinite(usd)) return 'missing';
  if (usd < 500) return 'critical';
  if (usd < 5_000) return 'low';
  return 'healthy';
}

export function liquidityRiskValueClass(usd: number | null | undefined): string {
  const tier = liquidityRiskTier(usd);
  if (tier === 'missing') return 'text-fg-muted';
  if (tier === 'critical') return 'text-signal-bear';
  if (tier === 'low') return 'text-signal-warn';
  return 'text-fg-primary';
}

export function headerStatValueClass(
  label: string,
  value: string,
  opts?: {
    liquidityUsd?: number | null;
    accent?: boolean;
    prosMuted?: boolean;
  },
): string {
  const dash = value === '\u2014' || value === '\u2026' || value === '';
  if (dash) return 'text-fg-muted';

  if (label === 'Liquidity') {
    return liquidityRiskValueClass(opts?.liquidityUsd);
  }

  if (label === 'Bonding' && opts?.accent) {
    return 'text-signal-warn';
  }

  if (label === 'Pros' && opts?.prosMuted) {
    return 'text-fg-muted';
  }

  return 'text-fg-primary';
}

export function tapeConfidenceLabel(
  indexed: boolean,
  volUsd: number,
  tf: string,
): { label: string; className: string } {
  if (!indexed) {
    return { label: 'Not indexed', className: 'text-fg-muted' };
  }
  if (volUsd <= 0) {
    return { label: `No swaps in ${tf}`, className: 'text-fg-muted' };
  }
  return { label: 'Indexed chain trades', className: 'text-fg-muted/80' };
}

export function metricMissingClass(): string {
  return cn('text-sm font-semibold tabular-nums text-fg-muted');
}
