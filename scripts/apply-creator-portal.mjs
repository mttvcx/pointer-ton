/**
 * Applies creator portal DDL + storage bucket + PostgREST reload.
 * Requires DATABASE_URL in .env.local (Supabase → Settings → Database → Connection string, pooler).
 *
 * Usage: node scripts/apply-creator-portal.mjs
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

const sqlPath = resolve(__dirname, 'creator-portal.sql');
const reloadPath = resolve(__dirname, 'reload-postgrest-schema.sql');
const ddl = readFileSync(sqlPath, 'utf8');
const reload = readFileSync(reloadPath, 'utf8');

async function runSql(databaseUrl) {
  const { default: postgres } = await import('postgres');
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    await sql.unsafe(ddl);
    await sql.unsafe(reload);
    console.log('✓ Creator portal tables applied');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function ensureStorageBucket() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn('Skip storage bucket — missing Supabase env');
    return;
  }
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(url, key);
  const { data: buckets } = await sb.storage.listBuckets();
  if (buckets?.some((b) => b.name === 'creator-verifications')) {
    console.log('✓ Storage bucket creator-verifications already exists');
    return;
  }
  const { error } = await sb.storage.createBucket('creator-verifications', {
    public: false,
    fileSizeLimit: 52_428_800,
    allowedMimeTypes: ['video/mp4', 'video/quicktime'],
  });
  if (error) throw new Error(error.message);
  console.log('✓ Created storage bucket creator-verifications');
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error(`
DATABASE_URL is not set in .env.local.

1. Supabase Dashboard → Project Settings → Database → Connection string (URI, pooler port 6543)
2. Add to .env.local: DATABASE_URL="postgres://..."
3. Re-run: node scripts/apply-creator-portal.mjs

Or paste scripts/creator-portal.sql in the SQL editor, then scripts/reload-postgrest-schema.sql
`);
    process.exit(1);
  }

  await runSql(databaseUrl);
  await ensureStorageBucket();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
