import { formatCompactUsd, formatNumber, formatSol } from '@/lib/utils/formatters';

export function walletSolUsdRate(solUsd: number | null | undefined): number | null {
  if (solUsd == null || !Number.isFinite(solUsd) || solUsd <= 0) return null;
  return solUsd;
}

export function usdToNative(usd: number, solUsd: number | null | undefined): number | null {
  const rate = walletSolUsdRate(solUsd);
  if (rate == null) return null;
  return usd / rate;
}

/** Format a USD-denominated wallet stat in USD or native (SOL) view. */
export function formatWalletMoney(
  usd: number | null | undefined,
  opts: {
    usdMode: boolean;
    solUsd: number | null | undefined;
    nativeSym?: string;
    compact?: boolean;
  },
): string {
  if (usd == null || !Number.isFinite(usd)) return '\u2014';
  if (opts.usdMode) {
    return opts.compact === false ? formatCompactUsd(usd) : formatCompactUsd(usd);
  }

  const native = usdToNative(usd, opts.solUsd);
  if (native == null) return '\u2014';

  const sym = opts.nativeSym ?? 'SOL';
  const sign = native < 0 ? '-' : '';
  const abs = Math.abs(native);
  const amount = opts.compact ? formatSol(abs) : formatNumber(abs, { decimals: 4 });
  return `${sign}${amount} ${sym}`;
}
