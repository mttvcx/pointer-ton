import 'server-only';

import { revalidateTag } from 'next/cache';

/** Bust Next.js pulse feed cache after indexer writes (webhook, poll, ingest). */
export function revalidatePulseFeedCache(): void {
  revalidateTag('pulse-feed', { expire: 0 });
}
