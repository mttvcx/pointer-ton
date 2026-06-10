import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dexPairExtendedMetrics } from '@/lib/market/dexPairMeta';
import { getPulseBondingRingState } from '@/lib/tokens/bondingProgress';
import { getPulseSocialModel } from '@/lib/tokens/pulseSocialLinks';
import { alternateQuotePairKind } from '@/lib/tokens/quoteToken';
import type { PulseTokenBundle } from '@/types/tokens';

const WIF = 'CExejcGZSEnk4FBsBQa3nMnU1jjCYsjw4x9d7cJ4pump';

function bundle(partial: Partial<PulseTokenBundle['token']>, snapExt?: Record<string, unknown>): PulseTokenBundle {
  return {
    token: {
      mint: WIF,
      symbol: 'WIF',
      name: 'dogwifhat',
      decimals: 6,
      launch_pad: 'pump.fun',
      created_at: new Date().toISOString(),
      ...partial,
    } as PulseTokenBundle['token'],
    snapshot: snapExt
      ? ({
          mint: WIF,
          extended_metrics: snapExt,
          snapshot_at: new Date().toISOString(),
        } as PulseTokenBundle['snapshot'])
      : null,
  };
}

describe('desk header ingest', () => {
  it('dexPairExtendedMetrics captures USDC quote and pumpswap migration', () => {
    const meta = dexPairExtendedMetrics({
      dexId: 'pumpswap',
      pairAddress: 'pair123',
      baseToken: { symbol: 'WIF' },
      quoteToken: { symbol: 'USDC', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
    });
    assert.equal(meta.quoteSymbol, 'USDC');
    assert.equal(meta.dexMigrated, true);
    assert.equal(meta.poolName, 'WIF/USDC');
  });

  it('alternateQuotePairKind resolves USDC from snapshot extended_metrics', () => {
    const kind = alternateQuotePairKind(
      bundle({}, { quoteSymbol: 'USDC', quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' }),
    );
    assert.equal(kind, 'usdc');
  });

  it('getPulseBondingRingState marks migrated from dexMigrated snapshot flag', () => {
    const state = getPulseBondingRingState(bundle({}, { dexMigrated: true, dexId: 'pumpswap' }));
    assert.equal(state.migrated, true);
    assert.equal(state.fillPct, 100);
  });

  it('getPulseBondingRingState marks migrated from pumpComplete raw metadata', () => {
    const state = getPulseBondingRingState(
      bundle({ raw_metadata: { pumpComplete: true }, migrated_at: null }),
    );
    assert.equal(state.migrated, true);
  });

  it('getPulseSocialModel picks up pump tweet URL stored on twitter_handle', () => {
    const tweet = 'https://x.com/i/status/2064142601972826253';
    const model = getPulseSocialModel(bundle({ twitter_handle: tweet }));
    assert.equal(model.twitterTweet?.url, tweet);
  });
});
