/**
 * Ground-truth Helius credit usage from the helius_usage table.
 * Run: node --import tsx scripts/helius-usage-report.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';

const url =
  process.env.SUPABASE_SERVICE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim() || '';
if (!url || !key) throw new Error('Missing Supabase service URL/key in env');

const supabase = createClient(url, key, { auth: { persistSession: false } });

type Row = { endpoint: string; credits_estimated: number; success: boolean; created_at: string };

async function report(hours: number) {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('helius_usage')
      .select('endpoint, credits_estimated, success, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(offset, offset + 999);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < 1000) break;
  }

  const byEndpoint = new Map<string, { credits: number; calls: number }>();
  let total = 0;
  for (const r of rows) {
    if (!r.success) continue;
    total += r.credits_estimated;
    const cur = byEndpoint.get(r.endpoint) ?? { credits: 0, calls: 0 };
    cur.credits += r.credits_estimated;
    cur.calls += 1;
    byEndpoint.set(r.endpoint, cur);
  }
  const sorted = [...byEndpoint.entries()].sort((a, b) => b[1].credits - a[1].credits);
  const perDay = total * (24 / hours);
  console.log(`\n=== last ${hours}h: ${rows.length} rows, ${total.toLocaleString()} credits ===`);
  console.log(`    → projected/day ${Math.round(perDay).toLocaleString()}  /month ${Math.round(perDay * 30).toLocaleString()}`);
  for (const [endpoint, v] of sorted) {
    const pct = total ? Math.round((v.credits / total) * 100) : 0;
    console.log(`    ${endpoint.padEnd(30)} ${String(v.credits).padStart(9)} cr  ${String(pct).padStart(3)}%  (${v.calls} calls)`);
  }
}

async function main() {
  await report(2);
  await report(24);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
