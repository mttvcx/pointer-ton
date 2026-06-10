/**
 * Applies indexer-mint-fk-decouple migration + PostgREST reload.
 * Requires DATABASE_URL in .env.local
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvLocal() {
  const path = resolve(root, '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq);
    let val = t.slice(eq + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const ddlPath = resolve(__dirname, 'indexer-mint-fk-decouple.sql');
const reloadPath = resolve(__dirname, 'reload-postgrest-schema.sql');
const ddl = readFileSync(ddlPath, 'utf8');
const reload = readFileSync(reloadPath, 'utf8');

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error('Missing DATABASE_URL in .env.local');
    process.exit(1);
  }
  const { default: postgres } = await import('postgres');
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await sql.unsafe(ddl);
    await sql.unsafe(reload);
    console.log('✓ indexer mint FK decouple migration applied');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
