import { formatDistanceToNowStrict } from 'date-fns';

const DEFAULT_LOCALE = 'en-US';

// User-facing placeholder ("em dash", U+2014). Source-safe ASCII escape.
const EMPTY = '\u2014';

/* ----------------------------- numeric formatters ----------------------------- */

/** Compact "$1.2M / $4.7K" used everywhere market caps and liquidity render. */
export function formatCompactUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return EMPTY;
  if (value === 0) return '$0';

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs < 1) return `${sign}$${abs.toFixed(4)}`;
  if (abs < 1_000) return `${sign}$${abs.toFixed(2)}`;

  const formatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
    notation: 'compact',
    maximumFractionDigits: 2,
  });
  return `${sign}$${formatter.format(abs)}`;
}

export function formatUsd(
  value: number | null | undefined,
  opts: { decimals?: number } = {},
): string {
  if (value == null || !Number.isFinite(value)) return EMPTY;
  const decimals = opts.decimals ?? (Math.abs(value) < 1 ? 4 : 2);
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** Pricing for memecoins routinely needs sub-penny precision. */
export function formatPriceUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return EMPTY;
  const abs = Math.abs(value);
  if (abs === 0) return '$0';
  if (abs >= 1) return formatUsd(value, { decimals: 4 });
  if (abs >= 0.01) return formatUsd(value, { decimals: 4 });
  if (abs >= 0.0001) return formatUsd(value, { decimals: 6 });
  // Sub-tick prices: surface significant digits without long zero runs.
  const sig = value.toPrecision(3);
  return `$${sig}`;
}

export function formatNumber(
  value: number | null | undefined,
  opts: { decimals?: number; compact?: boolean } = {},
): string {
  if (value == null || !Number.isFinite(value)) return EMPTY;
  const formatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: opts.decimals ?? 2,
    minimumFractionDigits: opts.decimals ?? 0,
  });
  return formatter.format(value);
}

export function formatPercent(
  value: number | null | undefined,
  opts: { decimals?: number; sign?: boolean } = {},
): string {
  if (value == null || !Number.isFinite(value)) return EMPTY;
  const decimals = opts.decimals ?? 2;
  const sign = opts.sign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/* ------------------------------ token amounts ------------------------------- */

/** Convert a raw on-chain amount (string/bigint) into a UI float using decimals. */
export function rawToUi(
  raw: string | bigint | number,
  decimals: number,
): number {
  if (decimals < 0) return 0;
  const big = typeof raw === 'bigint' ? raw : BigInt(String(raw));
  const divisor = 10n ** BigInt(decimals);
  const whole = big / divisor;
  const frac = big % divisor;
  return Number(whole) + Number(frac) / Number(divisor);
}

export function uiToRaw(ui: number, decimals: number): bigint {
  if (!Number.isFinite(ui) || ui < 0) return 0n;
  // Use string math to avoid float-precision corruption on common inputs.
  const [whole, frac = ''] = ui.toFixed(decimals).split('.');
  const wholePart = BigInt(whole ?? '0');
  const fracPart = BigInt((frac + '0'.repeat(decimals)).slice(0, decimals) || '0');
  return wholePart * 10n ** BigInt(decimals) + fracPart;
}

export const LAMPORTS_PER_SOL = 1_000_000_000;

export function lamportsToSol(lamports: number | bigint): number {
  return Number(lamports) / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.round(sol * LAMPORTS_PER_SOL));
}

export function formatSol(
  lamports: number | bigint | null | undefined,
  opts: { decimals?: number } = {},
): string {
  if (lamports == null) return EMPTY;
  const sol = lamportsToSol(lamports);
  const decimals = opts.decimals ?? (Math.abs(sol) < 1 ? 4 : 3);
  return `${sol.toFixed(decimals)} SOL`;
}

/* ------------------------------- time helpers ------------------------------- */

export function formatRelativeTime(value: Date | string | number | null | undefined): string {
  if (value == null) return EMPTY;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY;
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

/** "12s" / "4m" / "2h" / "3d" - compact age column for token rows. */
export function formatAgeShort(value: Date | string | number | null | undefined): string {
  if (value == null) return EMPTY;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY;
  const sec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3_600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86_400) return `${Math.floor(sec / 3_600)}h`;
  if (sec < 2_592_000) return `${Math.floor(sec / 86_400)}d`;
  if (sec < 31_536_000) return `${Math.floor(sec / 2_592_000)}mo`;
  return `${Math.floor(sec / 31_536_000)}y`;
}

export function formatLastActiveShort(unixSec: number | null | undefined): string {
  if (unixSec == null || !Number.isFinite(unixSec)) return EMPTY;
  return formatAgeShort(new Date(unixSec * 1000));
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return EMPTY;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}
