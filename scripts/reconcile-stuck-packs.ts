/**
 * Finish delivery for paid-but-stuck pack opens (status 'verified' that never
 * reached 'fulfilled'). Binds an open_id if the open route was killed before it
 * could, then drives /api/packs/fulfill-resume (admin/CRON_SECRET) until each
 * open is fully delivered. Idempotent — safe to re-run.
 *
 * Run:  node --import tsx scripts/reconcile-stuck-packs.ts
 * Needs: CRON_SECRET + Supabase service creds in .env.local. Hits the DEPLOYED app.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';

const url =
  process.env.SUPABASE_SERVICE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim() || '';
const CRON_SECRET = process.env.CRON_SECRET?.trim() || '';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://pointer-ton.vercel.app').replace(
  /\/$/,
  '',
);
if (!url || !key) throw new Error('Missing Supabase service URL/key in env');
if (!CRON_SECRET) throw new Error('Missing CRON_SECRET in env (admin reconcile gate)');

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function resume(paymentTx: string, openId: string | null) {
  const r = await fetch(`${APP_URL}/api/packs/fulfill-resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CRON_SECRET}` },
    body: JSON.stringify(openId ? { paymentTx, openId } : { paymentTx }),
  });
  return (await r.json().catch(() => ({}))) as { status?: string; delivered?: number; total?: number };
}

async function main() {
  const { data: pays } = await supabase
    .from('pack_payments')
    .select('id, payment_tx, user_id, open_id, status, created_at')
    .eq('status', 'verified')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!pays || pays.length === 0) {
    console.log('No stuck (verified) pack payments. Nothing to reconcile.');
    return;
  }

  for (const p of pays) {
    let openId: string | null = p.open_id;
    if (!openId) {
      // Killed before open_id was bound — match to the user's nearest live open.
      const { data: opens } = await supabase
        .from('pack_opens')
        .select('open_id, created_at, simulated')
        .eq('user_id', p.user_id)
        .eq('simulated', false)
        .order('created_at', { ascending: false })
        .limit(10);
      const pTime = new Date(p.created_at).getTime();
      let best: { open_id: string } | null = null;
      let bestDiff = Infinity;
      for (const o of opens ?? []) {
        const d = Math.abs(new Date(o.created_at).getTime() - pTime);
        if (d < bestDiff && d < 120_000) {
          bestDiff = d;
          best = { open_id: o.open_id };
        }
      }
      if (!best) {
        console.log(`payment ${p.payment_tx.slice(0, 10)}… — no matching open within 2min, skipping`);
        continue;
      }
      openId = best.open_id;
      await supabase.from('pack_payments').update({ open_id: openId }).eq('id', p.id);
      console.log(`bound ${p.payment_tx.slice(0, 10)}… → open ${openId.slice(0, 8)} (Δ${Math.round(bestDiff / 1000)}s)`);
    }

    for (let i = 0; i < 8; i++) {
      const j = await resume(p.payment_tx, openId);
      console.log(`  resume[${i}] ${p.payment_tx.slice(0, 10)}… → ${j.status} (${j.delivered ?? '?'}/${j.total ?? '?'})`);
      if (j.status === 'fulfilled' || j.status === 'failed' || j.status === 'not_found' || j.status === 'forbidden') {
        break;
      }
      await new Promise((r) => setTimeout(r, 2_000));
    }
  }
  console.log('\nDone.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
