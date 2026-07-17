/**
 * Which localStorage keys make up a user's account-synced "workspace layout".
 * Matched by PREFIX so versioned / per-chain variants come along too
 * (e.g. `pointer-pulse-columns-ton`, `pointer.topbar-nav.v1`).
 *
 * Deliberately curated — NOT every store. Sound uploads, one-time prompts, and
 * device-specific toggles stay local. These are the "how my terminal is arranged"
 * stores: docked panels, instant-trade/token layout, columns, table settings.
 */
export const LAYOUT_SYNC_PREFIXES: readonly string[] = [
  'pointer.shellPrefs',
  'pointer-dock-trackers',
  'pointer.token-page-layout',
  'pointer.token-dock-peek',
  'pointer.topbar-nav',
  'pointer-pulse-columns',
  'pointer.pulse-display',
  'pointer.trades-table',
  'pointer-holders-table-settings',
  'pointer.wallet-quickbuy',
  'pointer.chart-prefs',
];

export function isLayoutSyncKey(key: string): boolean {
  return LAYOUT_SYNC_PREFIXES.some((p) => key === p || key.startsWith(p));
}

/** Snapshot the current layout keys from localStorage → { key: value }. */
export function snapshotLayout(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof window === 'undefined') return out;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !isLayoutSyncKey(key)) continue;
      const val = localStorage.getItem(key);
      if (val != null) out[key] = val;
    }
  } catch {
    /* storage unavailable */
  }
  return out;
}

/**
 * Write server-side layout values into localStorage. Returns true if anything
 * actually changed (→ caller reloads once so the persisted stores re-init from
 * the restored values). Only touches keys in the sync allowlist.
 */
export function applyServerLayout(server: Record<string, string>): boolean {
  if (typeof window === 'undefined') return false;
  let changed = false;
  try {
    for (const [key, val] of Object.entries(server)) {
      if (!isLayoutSyncKey(key) || typeof val !== 'string') continue;
      if (localStorage.getItem(key) !== val) {
        localStorage.setItem(key, val);
        changed = true;
      }
    }
  } catch {
    /* storage unavailable */
  }
  return changed;
}
