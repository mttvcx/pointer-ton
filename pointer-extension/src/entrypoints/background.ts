import { ensureToken, apiBase, beginConnect, disconnect, exchangeCode } from '@/pointer/auth';
import type { PointerRequest, PointerResponse } from '@/pointer/client';

/**
 * Background service worker — the ONLY broker to `/api/ext/*`. Holds the scoped
 * token, attaches it, coalesces identical in-flight requests, and caches with
 * per-kind TTLs so hover cards hit <50ms on repeat. Content scripts only message
 * in; they never see the token or the raw network.
 */
export default defineBackground(() => {
  const mem = new Map<string, { at: number; data: unknown }>();
  const inflight = new Map<string, Promise<unknown>>();
  const TTL: Record<string, number> = {
    token: 20_000,
    profile: 60_000,
    wallet: 60_000,
    me: 30_000,
    ai: 5 * 60_000,
  };

  function pathFor(req: PointerRequest): { key: string; path: string; kind: string } | null {
    switch (req.type) {
      case 'pointer:token':
        return { key: `token:${req.mint}`, path: `/token/${req.mint}`, kind: 'token' };
      case 'pointer:profile':
        return { key: `profile:${req.handle}`, path: `/profile/${req.handle}`, kind: 'profile' };
      case 'pointer:wallet':
        return { key: `wallet:${req.address}`, path: `/wallet/${req.address}`, kind: 'wallet' };
      case 'pointer:me':
        return { key: 'me', path: `/me`, kind: 'me' };
      case 'pointer:ai':
        return { key: `ai:${req.kind}:${req.ref}`, path: `/ai/${req.kind}/${req.ref}`, kind: 'ai' };
      default:
        return null;
    }
  }

  async function brokered(req: PointerRequest): Promise<PointerResponse<unknown>> {
    if (req.type === 'pointer:connect') {
      await beginConnect();
      return { ok: false, error: 'connect_started' };
    }
    if (req.type === 'pointer:disconnect') {
      await disconnect();
      mem.clear();
      return { ok: true, data: { ok: true } };
    }
    if (req.type === 'pointer:submitLabel') {
      try {
        const token = await ensureToken();
        if (!token) return { ok: false, error: 'not_connected' };
        const res = await fetch(`${apiBase()}/api/ext/labels/submit`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ subjectType: req.subjectType, subject: req.subject, label: req.label, category: req.category }),
        });
        if (res.status === 401) return { ok: false, error: 'not_connected' };
        if (!res.ok) return { ok: false, error: `http_${res.status}` };
        mem.clear(); // labels changed — drop cache so the new tag shows
        return { ok: true, data: await res.json() };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'failed' };
      }
    }
    if (req.type === 'pointer:submitFollowers') {
      try {
        const token = await ensureToken();
        if (!token) return { ok: false, error: 'not_connected' };
        const res = await fetch(`${apiBase()}/api/ext/smart-followers/submit`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ handle: req.handle, followers: req.followers }),
        });
        if (!res.ok) return { ok: false, error: `http_${res.status}` };
        return { ok: true, data: await res.json() };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'failed' };
      }
    }
    if (req.type === 'pointer:submitCas') {
      try {
        const token = await ensureToken();
        if (!token) return { ok: false, error: 'not_connected' };
        const res = await fetch(`${apiBase()}/api/ext/cas/submit`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ handle: req.handle, cas: req.cas }),
        });
        if (!res.ok) return { ok: false, error: `http_${res.status}` };
        return { ok: true, data: await res.json() };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'failed' };
      }
    }
    if (req.type === 'pointer:labels') {
      const key = `labels:${req.handles.join(',')}|${req.wallets.join(',')}`;
      const cached = mem.get(key);
      if (cached && Date.now() - cached.at < 120_000) return { ok: true, data: cached.data };
      try {
        const token = await ensureToken();
        if (!token) return { ok: false, error: 'not_connected' };
        const res = await fetch(`${apiBase()}/api/ext/labels`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ handles: req.handles, wallets: req.wallets }),
        });
        if (res.status === 401) return { ok: false, error: 'not_connected' };
        if (!res.ok) return { ok: false, error: `http_${res.status}` };
        const data = await res.json();
        mem.set(key, { at: Date.now(), data });
        return { ok: true, data };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'failed' };
      }
    }
    const route = pathFor(req);
    if (!route) return { ok: false, error: 'bad_request' };

    const cached = mem.get(route.key);
    if (cached && Date.now() - cached.at < (TTL[route.kind] ?? 20_000)) {
      return { ok: true, data: cached.data };
    }
    if (inflight.has(route.key)) {
      return { ok: true, data: await inflight.get(route.key) };
    }

    const p = (async () => {
      const token = await ensureToken();
      if (!token) throw new Error('not_connected');
      const res = await fetch(`${apiBase()}/api/ext${route.path}`, {
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      });
      if (res.status === 401) throw new Error('not_connected');
      if (!res.ok) throw new Error(`http_${res.status}`);
      const data = await res.json();
      // Don't cache a transient "not found" profile (e.g. a blip mid-import) —
      // let it retry on the next view instead of sticking for the TTL.
      const skipCache = route.kind === 'profile' && data && (data as { found?: boolean }).found === false;
      if (!skipCache) mem.set(route.key, { at: Date.now(), data });
      return data;
    })();

    inflight.set(route.key, p);
    try {
      return { ok: true, data: await p };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'failed' };
    } finally {
      inflight.delete(route.key);
    }
  }

  chrome.runtime.onMessage.addListener((req: PointerRequest, _sender, sendResponse) => {
    // ALWAYS respond — a rejected broker promise must not hang the message channel
    // (that surfaces to the content script as a dead "Unavailable" card).
    brokered(req)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: e instanceof Error ? e.message : 'failed' }));
    return true; // async response
  });

  // The connect handshake: ONLY pointer.trade (externally_connectable) can send the
  // single-use code, which we exchange server-side for the scoped token.
  chrome.runtime.onMessageExternal.addListener(
    (msg: { pointerConnect?: { code?: string } }, _sender, sendResponse) => {
      const code = msg?.pointerConnect?.code;
      if (typeof code !== 'string' || !code) {
        sendResponse({ ok: false });
        return false;
      }
      exchangeCode(code).then((ok) => {
        mem.clear(); // fresh session → drop any stale cache
        sendResponse({ ok });
      });
      return true; // async
    },
  );
});
