/**
 * Founder Beta Sprint 2 — automated DB + classification checks.
 * Auth/trade/PnL share still require manual Phantom on localhost.
 *
 * Usage: npm run verify:founder-beta
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/supabase/types';
import { inferMintKind } from '../lib/chains/mintKind';
import { PROTOCOL_FILTER_MIN_CONFIDENCE } from '../lib/protocol/types';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v && v.length > 0 ? v : undefined;
}

function pct(num: number, den: number): string {
  if (den === 0) return 'n/a';
  return `${((num / den) * 100).toFixed(1)}%`;
}

async function main() {
  const url = env('SUPABASE_SERVICE_URL') ?? env('NEXT_PUBLIC_SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY') ?? env('SUPABASE_SECRET_KEY');
  if (!url || !key) {
    console.error('Missing Supabase admin env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }

  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('\n=== Founder Beta Sprint 2 — automated verification ===\n');

  const { data: tokens, error: tokErr } = await supabase
    .from('tokens')
    .select('mint, protocol_id, source_confidence, launch_pad, chain_id');
  if (tokErr) throw new Error(tokErr.message);

  const solRows = (tokens ?? []).filter((t) => {
    if (t.chain_id === 'sol') return true;
    if (t.launch_pad && ['pump.fun', 'bonk', 'bags'].includes(t.launch_pad)) return true;
    return inferMintKind(t.mint) === 'sol';
  });
  const solUnknown = solRows.filter(
    (t) => !t.protocol_id || (t.source_confidence ?? 0) < PROTOCOL_FILTER_MIN_CONFIDENCE,
  ).length;
  const solUnknownPass = solRows.length === 0 || solUnknown / solRows.length < 0.05;

  console.log('Sol unknown rate (Pulse classification):');
  console.log(`  ${solUnknown}/${solRows.length} (${pct(solUnknown, solRows.length)})`);
  console.log(`  → ${solUnknownPass ? 'PASS' : 'FAIL'} (target < 5%)\n`);

  const { data: users } = await supabase
    .from('users')
    .select('id, privy_id, wallet_address, email, starter_trackers_seeded_at, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('Recent users (latest 5):');
  if (!users?.length) {
    console.log('  (none — sign in with Phantom on localhost first)\n');
  } else {
    for (const u of users) {
      console.log(
        `  ${u.id.slice(0, 8)}… privy=${u.privy_id.slice(0, 12)}… wallet=${u.wallet_address?.slice(0, 12) ?? 'null'}… seeded=${u.starter_trackers_seeded_at ? 'yes' : 'no'}`,
      );
    }
    console.log('');
  }

  const latestUser = users?.[0];
  if (latestUser) {
    const uid = latestUser.id;

    const { data: wallets } = await supabase
      .from('user_wallets')
      .select('label, wallet_address, is_primary, is_imported, is_active')
      .eq('user_id', uid)
      .order('is_primary', { ascending: false });

    console.log(`user_wallets for latest user (${uid.slice(0, 8)}…):`);
    if (!wallets?.length) console.log('  (none — run auth + sync-privy)');
    else wallets.forEach((w) => console.log(`  ${w.is_primary ? '*' : ' '} ${w.label} ${w.wallet_address.slice(0, 8)}… imported=${w.is_imported}`));
    console.log('');

    const { count: groupCount } = await supabase
      .from('tracker_groups')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid);

    const { count: trackedCount } = await supabase
      .from('tracked_wallets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid);

    console.log(`Starter trackers: groups=${groupCount ?? 0}, tracked_wallets=${trackedCount ?? 0}`);
    console.log(`  starter_trackers_seeded_at: ${latestUser.starter_trackers_seeded_at ?? 'null'}\n`);

    const { data: trades } = await supabase
      .from('trades')
      .select('id, mint, side, amount_sol, status, tx_signature, confirmed_at')
      .eq('user_id', uid)
      .order('confirmed_at', { ascending: false })
      .limit(3);

    console.log('Recent trades (latest user):');
    if (!trades?.length) console.log('  (none — execute 0.001 SOL buy after Phantom connect)');
    else trades.forEach((t) => console.log(`  ${t.side} ${t.amount_sol} SOL ${t.status} ${t.tx_signature?.slice(0, 16)}…`));
    console.log('');

    const { data: points } = await supabase
      .from('user_points')
      .select('source, amount, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('Recent user_points:');
    if (!points?.length) console.log('  (none yet)');
    else points.forEach((p) => console.log(`  ${p.source} +${p.amount} @ ${p.created_at}`));
    console.log('');

    const { data: pnlCards } = await supabase
      .from('pnl_cards')
      .select('share_token, trade_id, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(3);

    console.log('PnL share cards:');
    if (!pnlCards?.length) console.log('  (none — create from portfolio after a trade)');
    else pnlCards.forEach((c) => console.log(`  /share/${c.share_token} trade=${c.trade_id.slice(0, 8)}…`));
    console.log('');
  }

  console.log('=== Manual matrix (Phantom required) ===');
  console.log('Set NEXT_PUBLIC_FOUNDER_BETA=1, restart dev, then:');
  console.log('  1. Connect Phantom → /pulse');
  console.log('  2. /portfolio, /track, /portfolio?tab=wallets, /points');
  console.log('  3. Token page → 0.001 SOL buy → quote → execute');
  console.log('  4. Portfolio → share PnL card → copy link → open /share/…');
  console.log('');

  if (!solUnknownPass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
