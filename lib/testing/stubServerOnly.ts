/**
 * Test-only side-effect import: neutralizes the `server-only` / `client-only`
 * guard packages by pre-seeding the CJS require cache with an empty module, so
 * server modules (which `import 'server-only'`) can be imported under
 * `node --test`. Import this FIRST, before any server module.
 */
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
for (const mod of ['server-only', 'client-only']) {
  try {
    const resolved = req.resolve(mod);
    // @ts-expect-error minimal CJS module record is enough for the cache hit
    req.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: {}, paths: [], children: [] };
  } catch {
    /* package not installed — nothing to stub */
  }
}
