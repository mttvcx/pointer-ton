import 'server-only';

import { currentInferenceMode } from '@/sibyl/inference/context';
import { isPrivateMode } from '@/sibyl/inference/types';

/**
 * Anonymized outbound retrieval. Sibyl's providers (web search, RPC, data APIs)
 * make external calls that leak the QUERY itself — a search provider learns you're
 * researching $FOO, an RPC learns which wallet you probed. In secure/confidential
 * mode we route those through an egress proxy so the upstream sees the proxy's IP,
 * not the user's, and we strip identifying headers. This protects the user's
 * *research signal* — the sharpest, cheapest privacy win for funds (see
 * docs/SIBYL_CONFIDENTIAL_COMPUTE.md §6).
 *
 * Inert until `SIBYL_ANON_PROXY_URL` is set → plain fetch. Adopt `retrievalFetch`
 * in a provider to make that provider's calls privacy-aware.
 */

function stripIdentifyingHeaders(init?: RequestInit): RequestInit | undefined {
  if (!init?.headers) return init;
  const h = new Headers(init.headers);
  // Don't forward anything that could tie the request back to the user session.
  for (const k of ['cookie', 'authorization', 'x-forwarded-for', 'referer', 'origin']) h.delete(k);
  return { ...init, headers: h };
}

export function anonymizedRetrievalActive(): boolean {
  return isPrivateMode(currentInferenceMode()) && Boolean(process.env.SIBYL_ANON_PROXY_URL?.trim());
}

export async function retrievalFetch(url: string, init?: RequestInit): Promise<Response> {
  const proxy = process.env.SIBYL_ANON_PROXY_URL?.trim();
  if (isPrivateMode(currentInferenceMode()) && proxy) {
    // Proxy forwards to `url` from its own egress IP; upstream never sees ours.
    const via = `${proxy}${proxy.includes('?') ? '&' : '?'}url=${encodeURIComponent(url)}`;
    return fetch(via, stripIdentifyingHeaders(init));
  }
  return fetch(url, init);
}
