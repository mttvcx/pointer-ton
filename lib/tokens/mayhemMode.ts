import type { PulseTokenBundle } from '@/types/tokens';

/** Pump.fun Mayhem Mode window — AI agent trades only during the first 24h after launch. */
export const PULSE_MAYHEM_WINDOW_MS = 24 * 60 * 60 * 1000;

const TRUTHY = new Set(['true', '1', 'yes', 'y']);

function boolish(v: unknown): boolean | null {
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v === 'number' && Number.isFinite(v)) return v !== 0;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (t === '') return null;
    if (TRUTHY.has(t)) return true;
    if (t === 'false' || t === '0' || t === 'no') return false;
  }
  return null;
}

function keyHintsMayhem(key: string): boolean {
  const l = key.toLowerCase();
  return (
    l === 'mayhem' ||
    l.includes('mayhem_mode') ||
    l.includes('mayhemmode') ||
    l.includes('is_mayhem') ||
    l.includes('ismayhem')
  );
}

function walkMayhem(obj: unknown, depth: number): boolean {
  if (depth > 12 || obj == null) return false;
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    const r = obj as Record<string, unknown>;
    for (const [key, val] of Object.entries(r)) {
      if (keyHintsMayhem(key) && boolish(val) === true) return true;
      if (typeof val === 'string' && val.toLowerCase().includes('mayhem')) return true;
      if (walkMayhem(val, depth + 1)) return true;
    }
    return false;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (walkMayhem(item, depth + 1)) return true;
    }
  }
  return false;
}

/** True when ingest marks a Pump.fun Mayhem Mode coin (24h agent window). */
export function isPulseMayhemToken(bundle: PulseTokenBundle): boolean {
  const lp = bundle.token.launch_pad?.toLowerCase() ?? '';
  if (lp === 'mayhem' || lp.includes('mayhem')) return true;

  if (bundle.token.raw_metadata && walkMayhem(bundle.token.raw_metadata, 0)) return true;
  if (bundle.snapshot?.extended_metrics && walkMayhem(bundle.snapshot.extended_metrics, 0)) {
    return true;
  }
  return false;
}

export function mayhemCreatedAtMs(bundle: PulseTokenBundle): number | null {
  const raw = bundle.token.created_at;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Milliseconds left in the 24h Mayhem window; null when inactive or expired. */
export function mayhemCountdownMs(bundle: PulseTokenBundle, nowMs = Date.now()): number | null {
  if (!isPulseMayhemToken(bundle)) return null;
  const created = mayhemCreatedAtMs(bundle);
  if (created == null) return null;
  const remaining = PULSE_MAYHEM_WINDOW_MS - (nowMs - created);
  if (remaining <= 0) return null;
  return remaining;
}

/** Axiom-style `23:59:37` countdown label. */
export function formatMayhemCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
