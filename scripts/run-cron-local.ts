#!/usr/bin/env node --import tsx
/**
 * Invoke Pointer cron endpoints locally (dev server must be running on :3001).
 *
 * Usage:
 *   node --import tsx scripts/run-cron-local.ts discover
 *   node --import tsx scripts/run-cron-local.ts enrich
 *   node --import tsx scripts/run-cron-local.ts index
 *   node --import tsx scripts/run-cron-local.ts retry
 *   node --import tsx scripts/run-cron-local.ts all
 */
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

const JOBS: Record<string, string> = {
  discover: '/api/cron/discover-tokens',
  enrich: '/api/cron/enrich-pulse',
  index: '/api/cron/index-active-mints',
  retry: '/api/cron/retry-failed-indexes',
  poll: '/api/cron/pulse-poll',
};

const base = process.env.POINTER_CRON_BASE_URL?.trim() || 'http://127.0.0.1:3001';
const secret = process.env.CRON_SECRET?.trim();

async function runJob(path: string) {
  const url = `${base.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (secret) headers.Authorization = `Bearer ${secret}`;
  const res = await fetch(url, { method: 'POST', headers });
  const body = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    json = body;
  }
  console.log(`\n[run-cron-local] ${path} → ${res.status}`);
  console.log(typeof json === 'string' ? json : JSON.stringify(json, null, 2));
  if (!res.ok) process.exitCode = 1;
}

async function main() {
  const arg = process.argv[2]?.toLowerCase() ?? 'all';
  if (arg === 'all') {
    for (const path of [
      JOBS.discover!,
      JOBS.enrich!,
      JOBS.index!,
      JOBS.retry!,
    ]) {
      await runJob(path);
    }
    return;
  }
  const path = JOBS[arg];
  if (!path) {
    console.error(`Unknown job "${arg}". Use: ${Object.keys(JOBS).join(', ')}, all`);
    process.exit(1);
  }
  await runJob(path);
}

main().catch((err) => {
  console.error('[run-cron-local] FAILED', err);
  process.exit(1);
});
