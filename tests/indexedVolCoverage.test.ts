import { indexedVolCoverageByTf } from '../lib/indexer/mintSwapWindowMetrics';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('indexedVolCoverageByTf', () => {
  it('marks 24h partial when history is only a few hours old', () => {
    const now = Date.now();
    const swaps = [
      {
        block_time: new Date(now - 2 * 60 * 60_000).toISOString(),
        side: 'buy',
        event_kind: 'swap',
        usd_amount: 10,
        price_usd: 1,
        token_amount_ui: 10,
        sol_amount: 1,
      },
    ] as never[];
    const cov = indexedVolCoverageByTf(swaps, now);
    assert.equal(cov['24h'], true);
    assert.equal(cov['6h'], true);
  });
});
