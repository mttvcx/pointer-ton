const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';

function toSubscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUBSCRIPT_DIGITS[Number(d)] ?? d)
    .join('');
}

export type TerminalBalanceParts =
  | { kind: 'plain'; text: string }
  | { kind: 'subscript'; leading: string; zeroCount: number; tail: string };

/** Axiom / MEVX-style tiny native balances — e.g. 0.0₂8 for 0.008 SOL. */
export function parseTerminalNativeBalance(amount: number | null | undefined): TerminalBalanceParts {
  if (amount == null || !Number.isFinite(amount)) return { kind: 'plain', text: '0' };
  if (amount === 0) return { kind: 'plain', text: '0' };

  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 1) {
    const t = abs.toFixed(2).replace(/\.?0+$/, '');
    return { kind: 'plain', text: `${sign}${t}` };
  }
  if (abs >= 0.01) {
    const t = abs.toFixed(2).replace(/\.?0+$/, '');
    return { kind: 'plain', text: `${sign}${t}` };
  }

  const str = abs.toFixed(12);
  const match = str.match(/^0\.(0*)([1-9]\d*)/);
  if (!match) return { kind: 'plain', text: String(amount) };

  const zeroCount = match[1]?.length ?? 0;
  const tail = match[2]?.slice(0, 1) ?? '';
  if (zeroCount < 2) {
    return { kind: 'plain', text: `${sign}${parseFloat(abs.toPrecision(3)).toString()}` };
  }

  return { kind: 'subscript', leading: `${sign}0.0`, zeroCount, tail };
}

/** Plain string with unicode subscripts — for titles and non-React formatters. */
export function formatTerminalNativeString(amount: number | null | undefined): string {
  const parts = parseTerminalNativeBalance(amount);
  if (parts.kind === 'plain') return parts.text;
  return `${parts.leading}${toSubscript(parts.zeroCount)}${parts.tail}`;
}

export { toSubscript };
