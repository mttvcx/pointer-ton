#!/usr/bin/env node --import tsx
/**
 * Run the full ingestion loop locally for N minutes (dev server on :3001).
 *
 * Usage:
 *   npm run dev   # separate terminal
 *   node --import tsx scripts/run-ingest-loop.ts
 *   node --import tsx scripts/run-ingest-loop.ts --minutes=15 --interval=120
 */
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((x) => x.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const minutes = Math.max(1, Number(arg('minutes', '12')));
const intervalSec = Math.max(30, Number(arg('interval', '120')));
const base = process.env.POINTER_CRON_BASE_URL?.trim() || 'http://127.0.0.1:3001';
const secret = process.env.CRON_SECRET?.trim();
const endAt = Date.now() + minutes * 60_000;

const CHAINS = ['sol', 'ton', 'bnb', 'base', 'eth'] as const;
const COLUMNS = ['new', 'stretch', 'migrated'] as const;

type Totals = {
  discovered: number;
  enrichedDex: number;
  enrichedMetrics: number;
  indexed: number;
  swapsInserted: number;
  heliusCalls: number;
  retries: number;
  failures: number;
};

const totals: Totals = {
  discovered: 0,
  enrichedDex: 0,
  enrichedMetrics: 0,
  indexed: 0,
  swapsInserted: 0,
  heliusCalls: 0,
  retries: 0,
  failures: 0,
};

async function cronPost(path: string): Promise<Record<string, unknown>> {
  const url = `${base.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (secret) headers.Authorization = `Bearer ${secret}`;
  const res = await fetch(url, { method: 'POST', headers });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`${path} → ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function countPulseRows(): Promise<Record<string, Record<string, number>>> {
  const out: Record<string, Record<string, number>> = {};
  for (const chain of CHAINS) {
    out[chain] = {};
    for (const column of COLUMNS) {
      try {
        const res = await fetch(
          `${base}/api/pulse/feed?column=${column}&chain=${chain}`,
          { headers: { Accept: 'application/json' } },
        );
        if (!res.ok) {
          out[chain][column] = 0;
          continue;
        }
        const json = (await res.json()) as { items?: unknown[]; bundles?: unknown[] };
        const rows = json.items ?? json.bundles;
        out[chain][column] = Array.isArray(rows) ? rows.length : 0;
      } catch {
        out[chain][column] = 0;
      }
    }
  }
  return out;
}

async function cycle(n: number) {
  console.log(`\n[ingest-loop] cycle ${n} @ ${new Date().toISOString()}`);

  try {
    const d = await cronPost('/api/cron/discover-tokens');
    if (!d.paused) {
      totals.discovered +=
        Number(d.solDas ?? 0) +
        Number(d.tonapi ?? 0) +
        Number(d.geckoEth ?? 0) +
        Number(d.geckoBsc ?? 0) +
        Number(d.geckoBase ?? 0);
    }
    console.log('[discover]', d);
  } catch (err) {
    totals.failures += 1;
    console.warn('[discover] failed', err);
  }

  try {
    const e = await cronPost('/api/cron/enrich-pulse');
    totals.enrichedDex += Number(e.dexPersisted ?? 0);
    totals.enrichedMetrics += Number(e.metricsPersisted ?? 0);
    console.log('[enrich]', e);
  } catch (err) {
    totals.failures += 1;
    console.warn('[enrich] failed', err);
  }

  try {
    const i = await cronPost('/api/cron/index-active-mints');
    totals.indexed += Number(i.indexedCount ?? 0);
    totals.swapsInserted += Number(i.totalSwapsInserted ?? 0);
    totals.heliusCalls += Number(i.totalHeliusCalls ?? 0);
    totals.failures += Number(i.failedCount ?? 0);
    console.log('[index]', {
      indexed: i.indexedCount,
      skipped: i.skippedAlreadyIndexedCount,
      helius: i.totalHeliusCalls,
      swaps: i.totalSwapsInserted,
    });
  } catch (err) {
    totals.failures += 1;
    console.warn('[index] failed', err);
  }

  if (n % 3 === 0) {
    try {
      const r = await cronPost('/api/cron/retry-failed-indexes');
      totals.retries += Number(r.retriedCount ?? 0);
      totals.heliusCalls += Number(r.totalHeliusCalls ?? 0);
      totals.failures += Number(r.failedCount ?? 0);
      console.log('[retry]', r);
    } catch (err) {
      totals.failures += 1;
      console.warn('[retry] failed', err);
    }
  }
}

async function main() {
  console.log(`[ingest-loop] ${minutes}m @ ${base}, interval ${intervalSec}s`);
  const before = await countPulseRows();
  console.log('[before]', JSON.stringify(before, null, 2));

  let cycleN = 0;
  while (Date.now() < endAt) {
    cycleN += 1;
    await cycle(cycleN);
    const remaining = endAt - Date.now();
    if (remaining <= 0) break;
    await new Promise((r) => setTimeout(r, Math.min(intervalSec * 1000, remaining)));
  }

  const after = await countPulseRows();
  console.log('\n[ingest-loop] SUMMARY');
  console.log(
    JSON.stringify(
      { minutes, cycles: cycleN, totals, pulseBefore: before, pulseAfter: after },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error('[ingest-loop] FAILED', err);
  process.exit(1);
});
