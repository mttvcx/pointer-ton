'use client';

import type { ReusedImageTokenRow } from '@/lib/db/tokens';

export const REUSED_IMAGE_STALE_MS = 5 * 60_000;
export const REUSED_IMAGE_GC_MS = 15 * 60_000;

export type ReusedImageResponse = {
  items: ReusedImageTokenRow[];
  total: number;
};

export function reusedImageQueryKey(imageUrl: string, excludeMint: string) {
  return ['tokens', 'reused-image', imageUrl, excludeMint] as const;
}

export async function fetchReusedImageTokens(
  imageUrl: string,
  excludeMint: string,
): Promise<ReusedImageResponse> {
  const qs = new URLSearchParams({
    imageUrl,
    excludeMint,
  });
  const r = await fetch(`/api/tokens/reused-image?${qs}`, { credentials: 'same-origin' });
  const j = (await r.json().catch(() => ({}))) as ReusedImageResponse & { message?: string };
  if (!r.ok) {
    throw new Error(typeof j.message === 'string' ? j.message : `reused-image ${r.status}`);
  }
  return { items: j.items ?? [], total: j.total ?? 0 };
}
