/** Deterministic avatar surface tint from a handle or id. */

const TINTS = [
  'bg-gradient-to-br from-cyan-900/70 to-bg-sunken ring-1 ring-cyan-500/25',
  'bg-gradient-to-br from-violet-900/60 to-bg-sunken ring-1 ring-violet-500/25',
  'bg-gradient-to-br from-emerald-900/55 to-bg-sunken ring-1 ring-emerald-500/25',
  'bg-gradient-to-br from-amber-900/50 to-bg-sunken ring-1 ring-amber-500/20',
  'bg-gradient-to-br from-sky-900/60 to-bg-sunken ring-1 ring-sky-500/25',
  'bg-gradient-to-br from-rose-900/50 to-bg-sunken ring-1 ring-rose-500/20',
] as const;

export function squadsAvatarTint(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return TINTS[h % TINTS.length]!;
}

export function initialsFromHandle(handle: string): string {
  const raw = handle.replace(/^@/, '').split(/[._-]/)[0] ?? '';
  if (raw.length >= 2) return raw.slice(0, 2).toUpperCase();
  return raw.padEnd(2, '?').slice(0, 2).toUpperCase();
}
