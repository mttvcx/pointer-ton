import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateMarketLighthouseFromBundles } from '@/lib/market/marketLighthouseAggregateCore';
import type { PulseTokenBundle } from '@/types/tokens';

const NOW = Date.parse('2026-06-11T12:00:00.000Z');
const PUMP_MINT_A = 'CExejcGZSEnk4FBsBQa3nMnU1jjCYsjw4x9d7cJ4pump';
const PUMP_MINT_B = 'GZQFCZjfzQyFSkA4jBuEeh5eKTLNzju7PZrEWxMvpump';
const BONK_MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

function bundle(partial: {
  mint: string;
  launch_pad?: string | null;
  protocol_id?: string | null;
  source_confidence?: number | null;
  created_at?: string;
  migrated_at?: string | null;
  snapshot?: PulseTokenBundle['snapshot'];
}): PulseTokenBundle {
  return {
    token: {
      mint: partial.mint,
      launch_pad: partial.launch_pad ?? 'pump.fun',
      protocol_id: partial.protocol_id ?? 'pump_fun',
      source_confidence: partial.source_confidence ?? 0.95,
      created_at: partial.created_at ?? '2026-06-11T11:30:00.000Z',
      migrated_at: partial.migrated_at ?? null,
    } as PulseTokenBundle['token'],
    snapshot: partial.snapshot ?? null,
  };
}

describe('aggregateMarketLighthouseFromBundles', () => {
  it('ranks launchpads and protocols by summed Dex volume', () => {
    const snap = (vol1h: number, dexId: string, buys = 60, sells = 40): PulseTokenBundle['snapshot'] =>
      ({
        id: 1,
        mint: 'x',
        market_cap_usd: null,
        liquidity_usd: null,
        price_usd: null,
        volume_5m_usd: null,
        volume_1h_usd: vol1h,
        volume_24h_usd: vol1h * 20,
        txns_5m: null,
        txns_1h: buys + sells,
        holder_count: null,
        top10_holder_pct: null,
        dev_holding_pct: null,
        extended_metrics: {
          dexId,
          txnsH1Buys: buys,
          txnsH1Sells: sells,
        },
        snapshot_at: new Date(NOW).toISOString(),
      });

    const bundles: PulseTokenBundle[] = [
      bundle({
        mint: PUMP_MINT_A,
        launch_pad: 'pump.fun',
        snapshot: snap(5_000_000, 'pumpfun'),
      }),
      bundle({
        mint: BONK_MINT,
        launch_pad: 'bonk',
        protocol_id: 'bonk',
        snapshot: snap(800_000, 'raydium'),
      }),
      bundle({
        mint: PUMP_MINT_B,
        launch_pad: 'pump.fun',
        snapshot: snap(3_000_000, 'pumpswap'),
      }),
    ];

    const out = aggregateMarketLighthouseFromBundles(bundles, 'sol', '1h', NOW);

    assert.equal(out.launchpads[0]?.key, 'pump.fun');
    assert.ok((out.launchpads[0]?.volumeUsd ?? 0) >= 8_000_000);
    assert.equal(out.launchpads[1]?.key, 'bonk');
    assert.ok(out.protocols.length >= 2);
    assert.equal(out.volume.headline, '$8.80M');
    assert.equal(out.trades.label, '300');
  });

  it('counts created and migrated tokens in the selected window', () => {
    const bundles: PulseTokenBundle[] = [
      bundle({
        mint: PUMP_MINT_A,
        created_at: '2026-06-11T11:50:00.000Z',
        snapshot: {
          id: 2,
          mint: PUMP_MINT_A,
          market_cap_usd: null,
          liquidity_usd: null,
          price_usd: null,
          volume_5m_usd: null,
          volume_1h_usd: 1000,
          volume_24h_usd: 20_000,
          txns_5m: null,
          txns_1h: 10,
          holder_count: null,
          top10_holder_pct: null,
          dev_holding_pct: null,
          extended_metrics: { dexId: 'raydium', txnsH1Buys: 5, txnsH1Sells: 5 },
          snapshot_at: new Date(NOW).toISOString(),
        },
      }),
      bundle({
        mint: PUMP_MINT_B,
        created_at: '2026-06-10T08:00:00.000Z',
        migrated_at: '2026-06-11T11:55:00.000Z',
        snapshot: {
          id: 3,
          mint: PUMP_MINT_B,
          market_cap_usd: null,
          liquidity_usd: null,
          price_usd: null,
          volume_5m_usd: null,
          volume_1h_usd: 500,
          volume_24h_usd: 10_000,
          txns_5m: null,
          txns_1h: 4,
          holder_count: null,
          top10_holder_pct: null,
          dev_holding_pct: null,
          extended_metrics: { dexId: 'pumpswap', txnsH1Buys: 2, txnsH1Sells: 2 },
          snapshot_at: new Date(NOW).toISOString(),
        },
      }),
    ];

    const out = aggregateMarketLighthouseFromBundles(bundles, 'sol', '1h', NOW);
    assert.equal(out.tokens.created.label, '1');
    assert.equal(out.tokens.migrations.label, '1');
  });
});
