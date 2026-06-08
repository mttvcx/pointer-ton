/**
 * Verify tracked_wallets UNIQUE(user_id, wallet_address) + starter seed idempotency.
 * Usage: npx tsx scripts/verify-tracked-wallets-unique.ts
 */
import { config } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { STARTER_WALLET_PACKS } from '../lib/trackers/starterWalletPacks';
import { normalizeWalletAddressForStorage } from '../lib/wallets/addressNormalize';

config({ path: '.env.local' });
config({ path: '.env' });

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function assertUniqueIndex(supabase: SupabaseClient): Promise<void> {
  const probeUserId = randomUUID();
  const wallet = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
  const { error: userErr } = await supabase.from('users').insert({
    id: probeUserId,
    privy_id: `verify-tracked-${probeUserId}`,
    wallet_address: `verify:${probeUserId}`,
  });
  if (userErr) throw new Error(`probe user insert: ${userErr.message}`);

  const row = { user_id: probeUserId, wallet_address: wallet, label: 'probe-a', notify: false };
  const { error: ins1 } = await supabase.from('tracked_wallets').insert(row);
  if (ins1) throw new Error(`probe insert 1: ${ins1.message}`);

  const { error: ins2 } = await supabase.from('tracked_wallets').insert(row);
  if (!ins2 || !/duplicate key|unique/i.test(ins2.message)) {
    throw new Error(`expected duplicate key on second insert, got: ${ins2?.message ?? 'success'}`);
  }

  const { data: ups, error: upErr } = await supabase
    .from('tracked_wallets')
    .upsert({ ...row, label: 'probe-b' }, { onConflict: 'user_id,wallet_address' })
    .select('*')
    .single();
  if (upErr) throw new Error(`probe upsert: ${upErr.message}`);
  if (ups.label !== 'probe-b') throw new Error('upsert did not update label on conflict');

  const { count: n, error: cntErr } = await supabase
    .from('tracked_wallets')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', probeUserId)
    .eq('wallet_address', wallet);
  if (cntErr) throw new Error(cntErr.message);
  if (n !== 1) throw new Error(`expected 1 row after upsert, got ${n}`);

  await supabase.from('tracked_wallets').delete().eq('user_id', probeUserId);
  await supabase.from('users').delete().eq('id', probeUserId);
  console.log('OK unique index + upsert onConflict user_id,wallet_address');
}

async function seedStarterTrackers(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: user } = await supabase.from('users').select('starter_trackers_seeded_at').eq('id', userId).single();
  if (user?.starter_trackers_seeded_at) return 0;

  const [{ data: wallets }, { data: groups }] = await Promise.all([
    supabase.from('tracked_wallets').select('id').eq('user_id', userId),
    supabase.from('tracker_groups').select('id').eq('user_id', userId),
  ]);

  if ((wallets?.length ?? 0) > 0 || (groups?.length ?? 0) > 0) {
    await supabase
      .from('users')
      .update({ starter_trackers_seeded_at: new Date().toISOString() })
      .eq('id', userId);
    return wallets?.length ?? 0;
  }

  let inserted = 0;
  for (const pack of STARTER_WALLET_PACKS) {
    const { data: group, error: gErr } = await supabase
      .from('tracker_groups')
      .insert({
        user_id: userId,
        label: pack.label,
        app_chain: pack.chain,
        is_starter: true,
        slug: pack.slug,
        sort_order: pack.sortOrder,
      })
      .select('*')
      .single();
    if (gErr) throw new Error(`insertTrackerGroup: ${gErr.message}`);

    for (const w of pack.wallets) {
      const norm = normalizeWalletAddressForStorage(w.address);
      if (!norm) continue;
      const { error: uErr } = await supabase
        .from('tracked_wallets')
        .upsert(
          {
            user_id: userId,
            wallet_address: norm,
            label: w.label,
            notify: false,
            group_id: group.id,
          },
          { onConflict: 'user_id,wallet_address' },
        );
      if (uErr) throw new Error(`upsertTrackedWallet: ${uErr.message}`);
      inserted += 1;
    }
  }

  await supabase
    .from('users')
    .update({ starter_trackers_seeded_at: new Date().toISOString() })
    .eq('id', userId);

  return inserted;
}

async function verifyStarterSeed(supabase: SupabaseClient): Promise<void> {
  const userId = randomUUID();
  const { error: userErr } = await supabase.from('users').insert({
    id: userId,
    privy_id: `verify-starter-${userId}`,
    wallet_address: `verify-starter:${userId}`,
    starter_trackers_seeded_at: null,
  });
  if (userErr) throw new Error(`starter user insert: ${userErr.message}`);

  console.log('--- first login (starter seed) ---');
  const seeded = await seedStarterTrackers(supabase, userId);
  const { data: afterFirst, error: l1 } = await supabase
    .from('tracked_wallets')
    .select('*')
    .eq('user_id', userId);
  if (l1) throw new Error(l1.message);
  const { data: userAfter } = await supabase
    .from('users')
    .select('starter_trackers_seeded_at')
    .eq('id', userId)
    .single();
  if (!userAfter?.starter_trackers_seeded_at) {
    throw new Error('starter_trackers_seeded_at not set after first seed');
  }
  if ((afterFirst?.length ?? 0) === 0) throw new Error('expected starter wallets after first seed');
  console.log(`  wallets: ${afterFirst?.length}, upsert calls: ${seeded}, starter_trackers_seeded_at: set`);

  console.log('--- duplicate login (idempotent) ---');
  const seededAgain = await seedStarterTrackers(supabase, userId);
  if (seededAgain !== 0) throw new Error(`second seed should no-op, got ${seededAgain} upserts`);
  const { data: afterSecond, error: l2 } = await supabase
    .from('tracked_wallets')
    .select('*')
    .eq('user_id', userId);
  if (l2) throw new Error(l2.message);
  if (afterSecond?.length !== afterFirst?.length) {
    throw new Error(
      `duplicate seed changed wallet count: ${afterFirst?.length} -> ${afterSecond?.length}`,
    );
  }
  console.log(`  wallets unchanged: ${afterSecond?.length}`);

  console.log('--- upsert duplicate protection ---');
  const sample = afterFirst![0]!;
  const { error: upErr } = await supabase
    .from('tracked_wallets')
    .upsert(
      {
        user_id: userId,
        wallet_address: sample.wallet_address,
        label: 'duplicate-upsert-test',
        notify: true,
        group_id: sample.group_id,
      },
      { onConflict: 'user_id,wallet_address' },
    );
  if (upErr) throw new Error(`duplicate upsert: ${upErr.message}`);

  const { data: afterUpsert, error: l3 } = await supabase
    .from('tracked_wallets')
    .select('*')
    .eq('user_id', userId);
  if (l3) throw new Error(l3.message);
  const matches = (afterUpsert ?? []).filter((w) => w.wallet_address === sample.wallet_address);
  if (matches.length !== 1) throw new Error(`expected 1 row for wallet, got ${matches.length}`);
  if (matches[0]!.label !== 'duplicate-upsert-test') {
    throw new Error('upsert did not update existing tracked wallet row');
  }
  if (afterUpsert!.length !== afterSecond!.length) {
    throw new Error('upsert created extra row instead of updating');
  }
  console.log('  single row preserved, label updated on conflict');

  await supabase.from('tracked_wallets').delete().eq('user_id', userId);
  await supabase.from('tracker_groups').delete().eq('user_id', userId);
  await supabase.from('users').delete().eq('id', userId);
  console.log('OK starter seed + duplicate protection');
}

async function main() {
  const supabase = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await assertUniqueIndex(supabase);
  await verifyStarterSeed(supabase);
  console.log('\n=== tracked_wallets verification passed ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
