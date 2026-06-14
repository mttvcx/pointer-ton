import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bundleMatchesPulseColumn,
  tokenIsPulseMigrated,
  tokenMatchesPulseNewRow,
  tokenMatchesPulseColumn,
} from '@/lib/pulse/columnGates';
import type { Tables } from '@/lib/supabase/types';
import type { PulseTokenBundle } from '@/types/tokens';

function token(partial: Partial<Tables<'tokens'>> & Pick<Tables<'tokens'>, 'mint'>): Tables<'tokens'> {
  const now = new Date().toISOString();
  return {
    id: partial.id ?? partial.mint,
    mint: partial.mint,
    name: partial.name ?? 'Test',
    symbol: partial.symbol ?? 'TST',
    chain: partial.chain ?? 'sol',
    created_at: partial.created_at ?? now,
    updated_at: partial.updated_at ?? now,
    migrated_at: partial.migrated_at ?? null,
    migrated_to: partial.migrated_to ?? null,
    bonding_progress: partial.bonding_progress ?? null,
    raw_metadata: partial.raw_metadata ?? null,
    creator_wallet: partial.creator_wallet ?? null,
    launch_pad: partial.launch_pad ?? null,
    twitter_handle: partial.twitter_handle ?? null,
    telegram_url: partial.telegram_url ?? null,
    website_url: partial.website_url ?? null,
    image_url: partial.image_url ?? null,
    is_paid: partial.is_paid ?? null,
    is_lp_locked: partial.is_lp_locked ?? null,
    mint_authority: partial.mint_authority ?? null,
    freeze_authority: partial.freeze_authority ?? null,
    protocol_id: partial.protocol_id ?? null,
    source_confidence: partial.source_confidence ?? null,
    classification_source: partial.classification_source ?? null,
    decimals: partial.decimals ?? 6,
  } as Tables<'tokens'>;
}

describe('pulse column gates', () => {
  it('excludes migrated_at rows from NEW', () => {
    const row = token({
      mint: 'm1',
      created_at: new Date().toISOString(),
      migrated_at: new Date().toISOString(),
    });
    assert.equal(tokenIsPulseMigrated(row), true);
    assert.equal(tokenMatchesPulseNewRow(row), false);
    assert.equal(tokenMatchesPulseColumn(row, 'new', 'sol'), false);
  });

  it('excludes bonding-complete rows from NEW', () => {
    const row = token({
      mint: 'm2',
      created_at: new Date().toISOString(),
      bonding_progress: 100,
    });
    assert.equal(tokenMatchesPulseNewRow(row), false);
  });

  it('keeps fresh unmigrated rows in NEW', () => {
    const row = token({
      mint: 'GZQFCZjfzQyFSkA4jBuEeh5eKTLNzju7PZrEWxMvpump',
      created_at: new Date().toISOString(),
      bonding_progress: 42,
    });
    assert.equal(tokenMatchesPulseNewRow(row), true);
    assert.equal(tokenMatchesPulseColumn(row, 'new', 'sol'), true);
  });

  it('bundle gate drops dexMigrated enrichment from NEW', () => {
    const bundle: PulseTokenBundle = {
      token: token({ mint: 'm4', created_at: new Date().toISOString() }),
      snapshot: {
        id: 1,
        mint: 'm4',
        market_cap_usd: 1_000_000,
        liquidity_usd: 50_000,
        price_usd: 0.01,
        volume_5m_usd: null,
        volume_1h_usd: null,
        volume_24h_usd: null,
        txns_5m: null,
        txns_1h: null,
        holder_count: null,
        top10_holder_pct: null,
        dev_holding_pct: null,
        extended_metrics: { dexMigrated: true },
        snapshot_at: new Date().toISOString(),
      },
    };
    assert.equal(bundleMatchesPulseColumn(bundle, 'new', 'sol'), false);
  });
});
