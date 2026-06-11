import 'server-only';

/**
 * Off-chain token metadata fetch (DAS `content.json_uri`).
 *
 * Pump.fun-style launches put twitter / telegram / website in this JSON, not
 * in the on-chain DAS payload — without fetching it the Pulse social strip can
 * only ever show a globe (often the metadata URL itself) and a search icon.
 */

const FETCH_TIMEOUT_MS = 4_000;
const MAX_BYTES = 64 * 1024;

export function jsonUriFromRawMetadata(raw: unknown): string | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const content = r.content;
  if (content != null && typeof content === 'object' && !Array.isArray(content)) {
    const uri = (content as Record<string, unknown>).json_uri;
    if (typeof uri === 'string' && /^https?:\/\//i.test(uri.trim())) return uri.trim();
  }
  const direct = r.json_uri ?? r.uri ?? r.metadata_uri;
  if (typeof direct === 'string' && /^https?:\/\//i.test(direct.trim())) return direct.trim();
  return null;
}

/** Whether token row already has at least one social column populated. */
export function tokenHasAnySocial(t: {
  twitter_handle: string | null;
  telegram_url: string | null;
  website_url: string | null;
}): boolean {
  return Boolean(
    t.twitter_handle?.trim() || t.telegram_url?.trim() || t.website_url?.trim(),
  );
}

export async function fetchOffchainTokenMetadata(
  jsonUri: string,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(jsonUri, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > MAX_BYTES) return null;
    const json: unknown = JSON.parse(text);
    if (json == null || typeof json !== 'object' || Array.isArray(json)) return null;
    return json as Record<string, unknown>;
  } catch {
    return null;
  }
}
