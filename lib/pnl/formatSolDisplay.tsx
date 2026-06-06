import { formatNumber, formatCompactUsd } from '@/lib/utils/formatters';

const SUB = '₀₁₂₃₄₅₆₇₈₉';

function subDigit(n: number): string {
  if (n >= 0 && n <= 9) return SUB[n] ?? String(n);
  return String(n);
}

/** Axiom-style tiny SOL: 0.0₂8 for 0.000028 */
export function formatSolTerminal(sol: number | null | undefined): string {
  if (sol == null || !Number.isFinite(sol)) return '—';
  if (sol === 0) return '0';
  if (sol >= 0.01) return formatNumber(sol, { decimals: sol >= 1 ? 2 : 3 });
  if (sol >= 1) return formatNumber(sol, { decimals: 2 });

  const raw = sol.toFixed(12).replace(/0+$/, '');
  const parts = raw.split('.');
  if (parts.length !== 2) return raw;
  const frac = parts[1] ?? '';
  let zeros = 0;
  for (const ch of frac) {
    if (ch === '0') zeros += 1;
    else break;
  }
  const sig = frac.slice(zeros, zeros + 2) || '0';
  if (zeros <= 1) return formatNumber(sol, { decimals: 4 });
  return `0.0${subDigit(zeros - 1)}${sig}`;
}

export function formatPnlTerminal(
  value: number | null | undefined,
  mode: 'sol' | 'usd',
): string {
  if (value == null || !Number.isFinite(value)) return mode === 'usd' ? '$0' : '+0';
  const pos = value >= 0;
  const abs = Math.abs(value);
  if (mode === 'usd') {
    const body = abs >= 1000 ? formatCompactUsd(abs) : `$${formatNumber(abs, { decimals: 2 })}`;
    return pos ? `+${body}` : `-${body}`;
  }
  if (abs < 0.0001 && abs > 0) {
    const s = formatSolTerminal(abs);
    return pos ? `+${s}` : `-${s}`;
  }
  const body = formatNumber(abs, { decimals: abs >= 1 ? 3 : 4 });
  return pos ? `+${body}` : `-${body}`;
}
