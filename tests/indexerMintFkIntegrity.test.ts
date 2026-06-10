import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

config({ path: resolve(root, '.env.local') });

const WIF = 'CExejcGZSEnk4FBsBQa3nMnU1jjCYsjw4x9d7cJ4pump';

describe('indexer mint FK decouple', () => {
  it('migration drops CASCADE FKs on indexer tables', () => {
    const sql = readFileSync(resolve(root, 'scripts/indexer-mint-fk-decouple.sql'), 'utf8');
    assert.match(sql, /mint_swaps_mint_fkey/);
    assert.match(sql, /mint_wallet_stats_mint_fkey/);
    assert.match(sql, /token_holders_mint_fkey/);
    assert.match(sql, /token_market_snapshots_mint_fkey/);
    assert.doesNotMatch(sql, /ON DELETE CASCADE/);
  });

  it('deleting tokens row does not delete mint_swaps', async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) {
      console.log('skip: no supabase credentials');
      return;
    }

    const sb = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { count: before } = await sb
      .from('mint_swaps')
      .select('id', { count: 'exact', head: true })
      .eq('mint', WIF);
    if ((before ?? 0) === 0) {
      console.log('skip: no WIF swaps to protect');
      return;
    }

    await sb.from('tokens').delete().eq('mint', WIF);

    const { count: after } = await sb
      .from('mint_swaps')
      .select('id', { count: 'exact', head: true })
      .eq('mint', WIF);

    assert.equal(after, before, 'mint_swaps must survive token row delete');

    await sb.from('tokens').upsert({
      mint: WIF,
      symbol: 'WIF',
      name: 'dogwifhat',
      decimals: 6,
      last_seen_at: new Date().toISOString(),
    });
  });
});
