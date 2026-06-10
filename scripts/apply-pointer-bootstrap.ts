/**
 * Apply Pointer Supabase bootstrap SQL to the project in .env.local.
 * Usage: npx tsx scripts/apply-pointer-bootstrap.ts [--incremental-only]
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Note: uses PostgREST rpc won't work for DDL — run via Supabase SQL API is not available.
 * This script splits files and prints instructions OR uses pg if DATABASE_URL is set.
 */
import { config } from 'dotenv';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

config({ path: '.env.local' });
config({ path: '.env' });

const ROOT = join(process.cwd(), 'scripts');
const PROJECT_REF = process.env.SUPABASE_PROJECT_ID?.trim();

async function runSql(client: pg.Client, label: string, sql: string) {
  console.log(`\n--- ${label} ---`);
  try {
    await client.query(sql);
    console.log('OK');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('FAIL:', msg);
    throw err;
  }
}

async function main() {
  const incrementalOnly = process.argv.includes('--incremental-only');
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    console.error(
      'Missing DATABASE_URL (Supabase → Settings → Database → Connection string → URI).\n' +
        'Set it in .env.local, then re-run.\n' +
        'Alternatively apply scripts manually via Supabase SQL editor in bootstrap-incremental-manifest order.',
    );
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  if (!incrementalOnly) {
    const core = readFileSync(join(ROOT, 'bootstrap-phase1-core.sql'), 'utf8');
    await runSql(client, 'bootstrap-phase1-core.sql', core);
  }

  const manifest = readFileSync(join(ROOT, 'bootstrap-incremental-manifest.txt'), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  for (const file of manifest) {
    const path = join(ROOT, file);
    if (!existsSync(path)) {
      console.warn('SKIP missing', file);
      continue;
    }
    const sql = readFileSync(path, 'utf8');
    await runSql(client, file, sql);
  }

  const { rows } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  console.log('\n=== public tables ===');
  for (const r of rows) console.log(r.tablename);
  console.log(`\nTotal: ${rows.length} tables (project ${PROJECT_REF ?? 'unknown'})`);

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
