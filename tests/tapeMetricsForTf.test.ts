import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tapeMetricsForTf } from '../lib/tokens/tokenTradeTapeByTf';
import type { TokenExtendedMetrics } from '../lib/types/tokenExtendedMetrics';

describe('tapeMetricsForTf', () => {
  it('returns indexed zero-activity windows instead of null', () => {
    const m: TokenExtendedMetrics = {
      top10HolderPct: null,
      devHoldingPct: null,
      sniperHolderPct: null,
      insidersPct: null,
      bundlersPct: null,
      lpBurnedPct: null,
      holders: null,
      proTraders: null,
      dexPaid: null,
      vol6hUsd: null,
      buys6h: null,
      sells6h: null,
      buyVol6hUsd: null,
      sellVol6hUsd: null,
      netVol6hUsd: null,
      taxPct: null,
      tapeByTf: {
        '5m': {
          volUsd: 0,
          buys: 0,
          sells: 0,
          buyVolUsd: 0,
          sellVolUsd: 0,
          netVolUsd: 0,
        },
      },
      indexedVolPartial: { '5m': false },
    };
    const tape = tapeMetricsForTf(m, '5m', 'mint');
    assert.ok(tape);
    assert.equal(tape!.volUsd, 0);
  });

  it('shows partial 24h indexed tape instead of hiding it', () => {
    const m: TokenExtendedMetrics = {
      top10HolderPct: null,
      devHoldingPct: null,
      sniperHolderPct: null,
      insidersPct: null,
      bundlersPct: null,
      lpBurnedPct: null,
      holders: null,
      proTraders: null,
      dexPaid: null,
      vol6hUsd: null,
      buys6h: null,
      sells6h: null,
      buyVol6hUsd: null,
      sellVol6hUsd: null,
      netVol6hUsd: null,
      taxPct: null,
      tapeByTf: {
        '24h': {
          volUsd: 1000,
          buys: 10,
          sells: 5,
          buyVolUsd: 600,
          sellVolUsd: 400,
          netVolUsd: 200,
        },
      },
      indexedVolPartial: { '24h': true },
    };
    const tape = tapeMetricsForTf(m, '24h', 'mint');
    assert.equal(tape?.volUsd, 1000);
  });

  it('falls back to Dex snapshot vol when indexed window is empty', () => {
    const m: TokenExtendedMetrics = {
      top10HolderPct: null,
      devHoldingPct: null,
      sniperHolderPct: null,
      insidersPct: null,
      bundlersPct: null,
      lpBurnedPct: null,
      holders: null,
      proTraders: null,
      dexPaid: null,
      vol6hUsd: null,
      buys6h: null,
      sells6h: null,
      buyVol6hUsd: null,
      sellVol6hUsd: null,
      netVol6hUsd: null,
      taxPct: null,
      dexTapeByTf: {
        '1h': {
          volUsd: 4200,
          buys: 0,
          sells: 0,
          buyVolUsd: 0,
          sellVolUsd: 0,
          netVolUsd: 0,
        },
      },
      indexedVolPartial: { '1h': false },
    };
    const tape = tapeMetricsForTf(m, '1h', 'mint');
    assert.equal(tape?.volUsd, 4200);
  });
});
