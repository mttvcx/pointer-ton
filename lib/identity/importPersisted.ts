import 'server-only';

import { loadIdentitySeedRowsFromDb, persistIdentitySeedRows } from '@/lib/db/identityRegistry';
import { importSeedRows } from '@/lib/identity/registry';
import type { IdentitySeedRow } from '@/lib/identity/types';

let hydrated = false;
let hydratePromise: Promise<void> | null = null;

/** Merge Postgres identity rows into the in-memory registry (once per process). */
export async function ensureIdentityRegistryHydrated(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const rows = await loadIdentitySeedRowsFromDb();
      if (rows.length > 0) importSeedRows(rows);
    } catch (err) {
      console.warn(
        '[identity] registry hydration failed:',
        err instanceof Error ? err.message : err,
      );
    } finally {
      hydrated = true;
    }
  })();
  return hydratePromise;
}

export async function prepareIdentityRegistry(): Promise<void> {
  await ensureIdentityRegistryHydrated();
}

/** Import seeds into memory + Postgres (survives restart). */
export async function importIdentitySeedsPersisted(rows: IdentitySeedRow[]): Promise<{
  imported: number;
  skipped: number;
  persisted: number;
  persistSkipped: number;
}> {
  await ensureIdentityRegistryHydrated();
  const memory = importSeedRows(rows);
  const db = await persistIdentitySeedRows(rows);
  return {
    imported: memory.imported,
    skipped: memory.skipped,
    persisted: db.imported,
    persistSkipped: db.skipped,
  };
}
