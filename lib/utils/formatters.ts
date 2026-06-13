import { formatDistanceToNowStrict } from 'date-fns';
import { formatTerminalNativeString } from '@/lib/utils/terminalNativeFormat';

const DEFAULT_LOCALE = 'en-US';

// User-facing placeholder ("em dash", U+2014). Source-safe ASCII escape.
const EMPTY = '\u2014';

/* ----------------------------- numeric formatters ----------------------------- */

/** Compact terminal MC / liquidity — "$15.4K", "$1.2M" (Axiom-style, not full dollars). */
export function formatCompactUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return EMPTY;
  if (value === 0) return '$0';

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs < 1) return `${sign}$${abs.toFixed(4)}`;
  if (abs < 1_000) return `${sign}$${abs.toFixed(2)}`;
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  return `${sign}$${(abs / 1_000).toFixed(1)}K`;
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

/**
 * Compact native balance (SOL, etc.) for nav trigger and wallet popover.
 * Pass a UI float in SOL — not lamports. For lamports use {@link formatSolFromLamports}.
 */
export function formatSol(amount: number): string {
  if (amount === 0) return '0';
  if (amount >= 100) return amount.toFixed(1).replace(/\.0$/, '');
  return formatTerminalNativeString(amount);
}

/** Session trade PnL footer — `+0(+0%)` style (Axiom parity). */
export function formatNativeTradePnl(pnl: number, pct: number | null): string {
  const pctRounded =
    pct == null || !Number.isFinite(pct) ? 0 : Math.abs(pct) < 0.05 ? 0 : Math.round(pct);
  const pctSign = pctRounded >= 0 ? '+' : '';
  if (pnl < 0) {
    return `${formatSol(pnl)}(${pctSign}${pctRounded}%)`;
  }
  return `+${formatSol(pnl)}(${pctSign}${pctRounded}%)`;
}

/** Lamports → compact SOL string (same rules as {@link formatSol}). */
export function formatSolFromLamports(
  lamports: number | bigint | null | undefined,
): string {
  if (lamports == null) return EMPTY;
  return formatSol(lamportsToSol(lamports));
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
export function normalizeRawAmount(
  raw: string | bigint | number | { rawAmount?: unknown } | null | undefined,
): string {
  if (raw == null) return '0';
  if (typeof raw === 'bigint') return raw.toString();
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(Math.trunc(raw));
  if (typeof raw === 'string') {
    const s = raw.trim();
    return s.length > 0 ? s : '0';
  }
  if (typeof raw === 'object' && 'rawAmount' in raw) {
    return normalizeRawAmount((raw as { rawAmount: unknown }).rawAmount as never);
  }
  return '0';
}

export function rawToUi(
  raw: string | bigint | number | { rawAmount?: unknown },
  decimals: number,
): number {
  if (decimals < 0) return 0;
  const normalized = normalizeRawAmount(raw);
  if (!/^\d+$/.test(normalized)) return 0;
  const big = BigInt(normalized);
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

/**
 * Lamports from APIs often arrive as decimal strings; `BigInt("")` and non-integers throw and can crash shells.
 */
export function parseLamportsStringToSol(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || !/^\d+$/.test(s)) return null;
  try {
    return lamportsToSol(BigInt(s));
  } catch {
    return null;
  }
}

export function solToLamports(sol: number): bigint {
  return BigInt(Math.round(sol * LAMPORTS_PER_SOL));
}

export function formatTonFromLamports(
  lamports: number | bigint | null | undefined,
  opts: { decimals?: number } = {},
): string {
  if (lamports == null) return EMPTY;
  const sol = lamportsToSol(lamports);
  const decimals = opts.decimals ?? (Math.abs(sol) < 1 ? 4 : 3);
  return `${sol.toFixed(decimals)} TON`;
}

/* ------------------------------- time helpers ------------------------------- */

export function formatRelativeTime(value: Date | string | number | null | undefined): string {
  if (value == null) return EMPTY;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY;
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

/** "12s" / "4m" / "2h" / "3d" - compact age column for token rows. */
export function formatAgeShort(
  value: Date | string | number | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (value == null) return EMPTY;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY;
  const sec = Math.max(0, Math.floor((nowMs - date.getTime()) / 1000));
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
