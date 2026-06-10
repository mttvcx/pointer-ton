import 'server-only';

import { cache } from 'react';
import { ensureTokenRowForMint } from '@/lib/helius/feed';
import type { TokenRow } from '@/lib/db/tokens';

function logTokenHydrate(
  phase: string,
  mint: string,
  extra?: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV === 'production') return;
  if (extra && Object.keys(extra).length > 0) {
    console.log(`[token-hydrate] ${phase}`, mint, extra);
  } else {
    console.log(`[token-hydrate] ${phase}`, mint);
  }
}

/** Cross-request-segment dedupe: metadata + page run in separate React trees in Next 16. */
const inflightHydrate = new Map<string, Promise<TokenRow | null>>();

async function hydrateTokenRowOnce(mint: string): Promise<TokenRow | null> {
  const key = mint.trim();
  const pending = inflightHydrate.get(key);
  if (pending) {
    logTokenHydrate('hydrate join in-flight', key);
    return pending;
  }

  const work = (async () => {
    logTokenHydrate('hydrate start', key);
    const row = await ensureTokenRowForMint(key);
    logTokenHydrate('hydrate finish', key, {
      rowMint: row?.mint ?? null,
      symbol: row?.symbol ?? null,
      returnValue: row ? 'row' : 'null',
    });
    return row;
  })();

  inflightHydrate.set(key, work);
  try {
    return await work;
  } finally {
    if (inflightHydrate.get(key) === work) {
      inflightHydrate.delete(key);
    }
  }
}

/**
 * Per-request token hydrate for `/token/[mint]` SSR.
 * Module in-flight map + React cache() so metadata and page share one DAS/Dex/DB pass.
 */
export const cachedEnsureTokenRowFromDas = cache(hydrateTokenRowOnce);
