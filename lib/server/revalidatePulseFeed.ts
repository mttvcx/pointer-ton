import 'server-only';

import { revalidateTag } from 'next/cache';
import { after } from 'next/server';

/** Bust Next.js pulse feed cache after indexer writes (never during RSC render). */
export function revalidatePulseFeedCache(): void {
  try {
    after(() => {
      revalidateTag('pulse-feed', { expire: 0 });
    });
  } catch {
    /* Non-request contexts (scripts/tests) — skip */
  }
}
