import type { TokenIntel, ProfileIntel, WalletIntel, ExtMe, ExtLabels } from '@/pointer/types';

/**
 * Pointer client (content-script side). Content scripts NEVER hold the auth token
 * or make cross-origin calls directly — they message the background service worker,
 * which is the sole broker to `/api/ext/*` (holds the scoped token, rate-limits,
 * caches). This keeps the token out of every page context and the surface auditable.
 */

export type PointerRequest =
  | { type: 'pointer:token'; mint: string }
  | { type: 'pointer:profile'; handle: string }
  | { type: 'pointer:wallet'; address: string }
  | { type: 'pointer:me' }
  | { type: 'pointer:connect' }
  | { type: 'pointer:disconnect' }
  | { type: 'pointer:labels'; handles: string[]; wallets: string[] }
  | { type: 'pointer:submitLabel'; subjectType: 'handle' | 'wallet'; subject: string; label: string; category?: string }
  | { type: 'pointer:submitCas'; handle: string; cas: { mint: string; chain?: string }[] }
  | { type: 'pointer:submitFollowers'; handle: string; followers: { handle: string; avatar?: string }[] }
  | { type: 'pointer:ai'; kind: 'token' | 'profile' | 'wallet' | 'project'; ref: string };

export type PointerResponse<T> = { ok: true; data: T } | { ok: false; error: string };

async function send<T>(req: PointerRequest): Promise<PointerResponse<T>> {
  try {
    return (await chrome.runtime.sendMessage(req)) as PointerResponse<T>;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'extension_unavailable' };
  }
}

export const pointer = {
  token: (mint: string) => send<TokenIntel>({ type: 'pointer:token', mint }),
  profile: (handle: string) => send<ProfileIntel>({ type: 'pointer:profile', handle }),
  wallet: (address: string) => send<WalletIntel>({ type: 'pointer:wallet', address }),
  me: () => send<ExtMe>({ type: 'pointer:me' }),
  connect: () => send<ExtMe>({ type: 'pointer:connect' }),
  disconnect: () => send<{ ok: boolean }>({ type: 'pointer:disconnect' }),
  labels: (handles: string[], wallets: string[]) => send<ExtLabels>({ type: 'pointer:labels', handles, wallets }),
  submitLabel: (subjectType: 'handle' | 'wallet', subject: string, label: string, category?: string) =>
    send<{ ok: boolean }>({ type: 'pointer:submitLabel', subjectType, subject, label, category }),
  submitCas: (handle: string, cas: { mint: string; chain?: string }[]) =>
    send<{ ok: boolean; stored: number }>({ type: 'pointer:submitCas', handle, cas }),
  submitFollowers: (handle: string, followers: { handle: string; avatar?: string }[]) =>
    send<{ ok: boolean; stored: number }>({ type: 'pointer:submitFollowers', handle, followers }),
};

/** Deep links back into Pointer — the funnel. The extension never signs; trade
 *  intents open Pointer with the action pre-filled. */
export function pointerUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path}`;
}
export const deepLinks = {
  token: (base: string, mint: string) => pointerUrl(base, `/token/${encodeURIComponent(mint)}`),
  quickBuy: (base: string, mint: string) =>
    pointerUrl(base, `/token/${encodeURIComponent(mint)}?action=buy&src=ext`),
  wallet: (base: string, addr: string) => pointerUrl(base, `/wallet/${encodeURIComponent(addr)}`),
};
