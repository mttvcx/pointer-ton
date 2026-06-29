import { ensureToken, apiBase, beginConnect } from '@/pointer/auth';
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
      mem.set(route.key, { at: Date.now(), data });
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
    brokered(req).then(sendResponse);
    return true; // async response
  });
});
