'use client';

/**
 * In-flight dedup for AI scans: same key within 30s awaits one network call.
 * Server still has the global Redis/DB cache; this only stops hover jitter.
 */

const pendingScans = new Map<string, Promise<unknown>>();

export function aiScanClientKey(url: string, body: unknown): string {
  const stable =
    body && typeof body === 'object' && !Array.isArray(body)
      ? JSON.stringify(body, Object.keys(body as Record<string, unknown>).sort())
      : JSON.stringify(body);
  return `${url}:${stable}`;
}

export async function fetchAiScan<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const existing = pendingScans.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fetcher().finally(() => {
    setTimeout(() => pendingScans.delete(key), 30_000);
  });
  pendingScans.set(key, promise);
  return promise;
}
