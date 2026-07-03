/** Hermes-safe thousands grouping (no Intl). "12345" → "12,345". */
export function group(s: string): string {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Exact dollar amount with grouped thousands. `dec` = decimal places (default 2). */
export function usd(n: number, dec = 2): string {
  const neg = n < 0;
  const [i, f] = Math.abs(n).toFixed(dec).split('.');
  return `${neg ? '-' : ''}$${group(i)}${dec ? '.' + f : ''}`;
}

export function compactUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function priceUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(2)}`;
}

/**
 * Stable demo price-change % derived from the mint (the live API has no 24h-change
 * field yet). Deterministic so it doesn't flicker between renders. Demo-only — to
 * fill the UI with FOMO-style colored gain/loss until the backend exposes change.
 */
export function pseudoChange(seed: string): { pct: string; up: boolean } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const v = (Math.abs(h) % 11000) / 100 - 38; // ~ -38% … +72%
  return { pct: `${Math.abs(v).toFixed(2)}%`, up: v >= 0 };
}

export function shortMint(mint: string): string {
  return mint.length > 8 ? `${mint.slice(0, 4)}…${mint.slice(-4)}` : mint;
}

export function ageShort(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
