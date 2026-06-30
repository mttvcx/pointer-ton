/**
 * Scoped-token auth (background only). The extension does NOT reuse the raw Privy
 * session — it holds a short-lived, revocable token scoped to `intel.read
 * trade.intent`, tied to this extension id. This directly answers the readiness
 * audit's auth-handoff + revocation blockers.
 *
 * Flow (Phase 1 implements the server side under /api/ext/auth/*):
 *   1. User clicks Connect → open `${BASE}/extension/connect` (logged-in session).
 *   2. Pointer shows an approve screen, mints a one-time code.
 *   3. Extension exchanges the code at `/api/ext/auth/exchange` for {token, refresh, exp}.
 *   4. Token stored in chrome.storage.session; silent refresh before exp.
 *   5. Revoke from pointer.trade kills it server-side (revocation check on every call).
 */

const TOKEN_KEY = 'pointer.ext.token';

/** Network timeout for every Pointer auth call — a backend blip (e.g. a DB
 *  hiccup upstream) must fail fast with a clear result instead of hanging the
 *  connect / refresh forever. AbortSignal.timeout is supported in MV3 SW. */
const NET_TIMEOUT_MS = 12_000;

export interface ExtToken {
  token: string;
  refresh: string;
  exp: number; // epoch seconds
}

/** Pointer API base, baked per build (POINTER_API_BASE). */
export function apiBase(): string {
  return (import.meta.env.VITE_POINTER_API_BASE as string | undefined)?.replace(/\/$/, '')
    || 'https://pointer.trade';
}

export async function getToken(): Promise<ExtToken | null> {
  const raw = await chrome.storage.session.get(TOKEN_KEY);
  return (raw[TOKEN_KEY] as ExtToken | undefined) ?? null;
}

async function setToken(t: ExtToken | null): Promise<void> {
  if (t) await chrome.storage.session.set({ [TOKEN_KEY]: t });
  else await chrome.storage.session.remove(TOKEN_KEY);
}

/** Valid (non-expired, with 30s skew) access token, refreshing silently if needed. */
export async function ensureToken(): Promise<string | null> {
  const t = await getToken();
  if (!t) return null;
  const now = Math.floor(Date.now() / 1000);
  if (t.exp - 30 > now) return t.token;
  return refresh(t);
}

async function refresh(t: ExtToken): Promise<string | null> {
  try {
    const res = await fetch(`${apiBase()}/api/ext/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh: t.refresh, ext: chrome.runtime.id }),
      signal: AbortSignal.timeout(NET_TIMEOUT_MS),
    });
    if (!res.ok) {
      await setToken(null);
      return null;
    }
    const next = (await res.json()) as ExtToken;
    await setToken(next);
    return next.token;
  } catch {
    return null;
  }
}

/** Begin the connect flow — opens the Pointer approve page. The exchange completes
 *  when that page posts the one-time code back (Phase 1 wires the message channel). */
export async function beginConnect(): Promise<void> {
  await chrome.tabs.create({ url: `${apiBase()}/extension/connect?ext=${chrome.runtime.id}` });
}

export async function exchangeCode(code: string): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}/api/ext/auth/exchange`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, ext: chrome.runtime.id }),
      signal: AbortSignal.timeout(NET_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    await setToken((await res.json()) as ExtToken);
    return true;
  } catch {
    return false;
  }
}

export async function disconnect(): Promise<void> {
  const t = await getToken();
  if (t) {
    try {
      await fetch(`${apiBase()}/api/ext/auth/revoke`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${t.token}` },
        signal: AbortSignal.timeout(NET_TIMEOUT_MS),
      });
    } catch {
      /* best-effort; token also dies on TTL */
    }
  }
  await setToken(null);
}
