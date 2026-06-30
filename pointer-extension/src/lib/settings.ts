/**
 * Local extension settings — stored in chrome.storage.local so every toggle
 * works in-popup with zero round-trips. Trading/scan settings here are the
 * extension's own preferences; account-level config still lives in Pointer.
 */

export type Language = 'en' | 'zh' | 'ru';

export interface ExtSettings {
  language: Language;
  showChangelog: boolean;
  hoverCards: boolean; // master switch for the on-page hover overlays
  quickBuyPresetsSol: number[]; // trading: quick-buy notionals
  defaultSlippageBps: number; // trading
  xInlineCards: boolean; // X/Twitter: render token/wallet cards inline
}

export const DEFAULT_SETTINGS: ExtSettings = {
  language: 'en',
  showChangelog: true,
  hoverCards: true,
  quickBuyPresetsSol: [0.5, 1, 2],
  defaultSlippageBps: 500,
  xInlineCards: true,
};

const K = 'pointer.settings';

export async function getSettings(): Promise<ExtSettings> {
  const raw = await chrome.storage.local.get(K);
  return { ...DEFAULT_SETTINGS, ...(raw[K] as Partial<ExtSettings> | undefined) };
}

export async function setSettings(patch: Partial<ExtSettings>): Promise<ExtSettings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [K]: next });
  return next;
}

/** Approximate bytes of everything the extension has cached locally. */
export async function cacheBytes(): Promise<number> {
  // chrome.storage.local.getBytesInUse is the source of truth where available.
  const api = chrome.storage.local as unknown as { getBytesInUse?: (k: null) => Promise<number> };
  if (typeof api.getBytesInUse === 'function') {
    try {
      return await api.getBytesInUse(null);
    } catch {
      /* fall through */
    }
  }
  const all = await chrome.storage.local.get(null);
  return new Blob([JSON.stringify(all)]).size;
}

/** Clear transient caches (token/wallet intel) but KEEP labels, settings, auth. */
export async function clearCache(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const keep = (k: string) =>
    k.startsWith('pointer.labels') || k === 'pointer.settings' || k.startsWith('pointer.ext');
  const drop = Object.keys(all).filter((k) => !keep(k));
  if (drop.length) await chrome.storage.local.remove(drop);
  // Session cache (intel responses) is fully transient — safe to wipe.
  try {
    await chrome.storage.session.clear();
  } catch {
    /* session may not be writable in all contexts */
  }
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
