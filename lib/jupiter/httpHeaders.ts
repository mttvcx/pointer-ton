import 'server-only';

/** Shared Jupiter API headers (quote, swap, price). */
export function jupiterRequestHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const key = process.env.JUPITER_API_KEY?.trim();
  if (key) headers['x-api-key'] = key;
  if (extra) {
    for (const [k, v] of Object.entries(extra as Record<string, string>)) {
      headers[k] = v;
    }
  }
  return headers;
}

/** Turn undici/network failures into actionable copy (not bare "fetch failed"). */
export function wrapJupiterFetchError(err: unknown, endpoint: string): Error {
  if (!(err instanceof Error)) return new Error(`Jupiter ${endpoint} failed`);
  const msg = err.message.toLowerCase();
  if (
    msg.includes('fetch failed') ||
    msg.includes('enotfound') ||
    msg.includes('getaddrinfo') ||
    msg.includes('econnrefused')
  ) {
    return new Error(
      `Jupiter ${endpoint} unreachable — check JUPITER_QUOTE_URL / JUPITER_SWAP_URL (quote-api.jup.ag is deprecated; use lite-api.jup.ag/swap/v1 or api.jup.ag/swap/v1)`,
    );
  }
  return err;
}
