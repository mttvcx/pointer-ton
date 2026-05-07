/**
 * Regenerate `lib/supabase/types.ts` from the linked Supabase project.
 *
 * Prerequisites:
 *   - `SUPABASE_PROJECT_ID` in `.env` or `.env.local`
 *   - `supabase login` once on this machine (or `SUPABASE_ACCESS_TOKEN` in env)
 *
 * Usage: `npm run gen:types`
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

const projectId = process.env.SUPABASE_PROJECT_ID;
if (!projectId) {
  console.error('Missing SUPABASE_PROJECT_ID (set in .env or .env.local)');
  process.exit(1);
}

const outPath = path.join(process.cwd(), 'lib', 'supabase', 'types.ts');

const result = spawnSync(
  'npx',
  [
    '--yes',
    'supabase',
    'gen',
    'types',
    'typescript',
    '--project-id',
    projectId,
    '--schema',
    'public',
  ],
  {
    encoding: 'utf-8',
    shell: true,
    maxBuffer: 50 * 1024 * 1024,
  },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || 'supabase gen types failed');
  process.exit(result.status ?? 1);
}

const stdout = result.stdout ?? '';
if (!stdout.includes('export type Database')) {
  console.error(
    'Unexpected output from supabase gen types (no Database export). Raw output:\n',
    stdout.slice(0, 500),
  );
  process.exit(1);
}

writeFileSync(outPath, stdout, 'utf8');
console.log(`Wrote ${outPath} (${stdout.length} bytes)`);
