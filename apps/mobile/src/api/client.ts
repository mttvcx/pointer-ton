import { API_URL } from '../env';

/**
 * Thin typed client to the existing Pointer API. The web and mobile apps share
 * the SAME backend (stateless Bearer-token auth), so a request is just:
 *   GET/POST <API_URL><path> with Authorization: Bearer <Privy access token>.
 *
 * (When the Turborepo restructure lands, this becomes packages/api-client and is
 * shared with apps/web.)
 */
export type ApiOptions = {
  token?: string | null;
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
};

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    if (json && typeof json === 'object') {
      const o = json as Record<string, unknown>;
      if (typeof o.message === 'string') message = o.message;
      else if (typeof o.error === 'string') message = o.error;
    }
    throw new ApiError(message, res.status, json);
  }
  return json as T;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public body: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
