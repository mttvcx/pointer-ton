import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTrackedWalletSwapsFromTx } from '@/lib/helius/parseTrackedWalletSwaps';

const TRACKED = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

describe('tracked wallet webhook parser', () => {
  it('parses buy swap from enhanced tx shape', () => {
    const tx = {
      signature: '5demoSig111111111111111111111111111111111111111111111111111111111',
      timestamp: Math.floor(Date.now() / 1000),
      feePayer: TRACKED,
      type: 'SWAP',
      tokenTransfers: [
        {
          mint: MINT,
          tokenAmount: 1200,
          fromUserAccount: 'Pool1111111111111111111111111111111111111',
          toUserAccount: TRACKED,
        },
      ],
      nativeTransfers: [
        {
          fromUserAccount: TRACKED,
          toUserAccount: 'Pool1111111111111111111111111111111111111',
          amount: 500_000_000,
        },
      ],
    };

    const swaps = parseTrackedWalletSwapsFromTx(tx);
    assert.ok(swaps.length >= 1);
    assert.equal(swaps[0]!.wallet, TRACKED);
    assert.equal(swaps[0]!.mint, MINT);
    assert.equal(swaps[0]!.side, 'buy');
    assert.ok(swaps[0]!.solAmount > 0);
  });

  it('returns empty for non-swap tx', () => {
    const swaps = parseTrackedWalletSwapsFromTx({ signature: 'x', feePayer: TRACKED });
    assert.equal(swaps.length, 0);
  });
});
