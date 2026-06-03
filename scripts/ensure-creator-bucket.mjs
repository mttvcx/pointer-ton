import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq);
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing Supabase env');
  process.exit(1);
}

const sb = createClient(url, key);
const { data: buckets, error } = await sb.storage.listBuckets();
if (error) {
  console.error(error.message);
  process.exit(1);
}
if (buckets.some((b) => b.name === 'creator-verifications')) {
  console.log('bucket exists');
  process.exit(0);
}
const { error: createErr } = await sb.storage.createBucket('creator-verifications', {
  public: false,
  fileSizeLimit: 52_428_800,
  allowedMimeTypes: ['video/mp4', 'video/quicktime'],
});
if (createErr) {
  console.error(createErr.message);
  process.exit(1);
}
console.log('bucket created');
