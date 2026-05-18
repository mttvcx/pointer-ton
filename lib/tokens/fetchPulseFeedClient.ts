'use client';

import type { PulseColumnId } from '@/lib/utils/constants';
import type { PulseTokenBundle } from '@/types/tokens';

/**
 * Fetches Pulse feed rows. Prefer `/api/pulse/feed` — it avoids any ambiguity with
 * `/api/tokens/[mint]` routing in dev/production. Falls back to the legacy URL
 * on 404 (older deployments) only.
 */
export async function fetchPulseFeedBundles(
  column: PulseColumnId,
  chain: string,
): Promise<PulseTokenBundle[]> {
  const qs = new URLSearchParams({ column, chain });
  const paths = ['/api/pulse/feed', '/api/tokens/feed'] as const;
  let lastMessage = 'feed 404';
  for (const path of paths) {
    const r = await fetch(`${path}?${qs}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (r.ok) {
      const j = (await r.json()) as { items?: PulseTokenBundle[] };
      return j.items ?? [];
    }
    const j = (await r.json().catch(() => ({}))) as { message?: string };
    lastMessage = j.message ?? `feed ${r.status}`;
    if (r.status !== 404) {
      throw new Error(lastMessage);
    }
  }
  throw new Error(lastMessage);
}
