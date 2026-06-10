import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSwapFromEnhancedTx } from '@/lib/indexer/parseSwapFromEnhancedTx';
import type { HeliusEnhancedTx } from '@/lib/indexer/heliusEnhanced';

const MINT = 'GZQFCZjfzQyFSkA4jBuEeh5eKTLNzju7PZrEWxMvpump';
const POOL = '8YAyrz42UK6dtDUHga58esyBzSpjqLYovj9RkLusnMA1';

describe('parseSwapFromEnhancedTx', () => {
  it('parses PumpSwap sell leg', () => {
    const tx: HeliusEnhancedTx = {
      signature: '3JoXCJfpooYtvV5uTEST',
      timestamp: 1_780_964_846,
      slot: 123,
      feePayer: 'LcxeUtM2uaciTB1H778scjmk4Ho53kN6JQNZm9yXzFJ',
      type: 'SWAP',
      source: 'PUMP_AMM',
      tokenTransfers: [
        {
          fromUserAccount: 'LcxeUtM2uaciTB1H778scjmk4Ho53kN6JQNZm9yXzFJ',
          toUserAccount: POOL,
          tokenAmount: 50.782475,
          mint: MINT,
        },
      ],
      nativeTransfers: [
        {
          fromUserAccount: 'BHTnV8tuZSuFuspwk1NCPCNjec4BHUE6G4T3HSawNep2',
          toUserAccount: 'LcxeUtM2uaciTB1H778scjmk4Ho53kN6JQNZm9yXzFJ',
          amount: 44_631_801,
        },
      ],
    };

    const parsed = parseSwapFromEnhancedTx({
      tx,
      mint: MINT,
      poolHint: POOL,
      solUsd: 200,
      decimals: 6,
    });

    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.swap.eventKind, 'swap');
    assert.equal(parsed.swap.side, 'sell');
    assert.equal(parsed.swap.wallet, tx.feePayer);
    assert.ok(parsed.swap.solAmount > 0);
    assert.ok(parsed.swap.tokenAmountUi > 0);
  });

  it('parses remove liquidity WITHDRAW with large SOL out', () => {
    const tx: HeliusEnhancedTx = {
      signature: 'withdraw1',
      timestamp: 1_780_964_900,
      feePayer: 'DevWalletRemoveLiq1111111111111111111',
      type: 'WITHDRAW',
      source: 'PUMP_AMM',
      tokenTransfers: [
        {
          mint: MINT,
          tokenAmount: 500_000,
          fromUserAccount: POOL,
          toUserAccount: 'DevWalletRemoveLiq1111111111111111111',
        },
      ],
      nativeTransfers: [
        {
          fromUserAccount: POOL,
          toUserAccount: 'DevWalletRemoveLiq1111111111111111111',
          amount: 338_100_000_000,
        },
      ],
    };
    const parsed = parseSwapFromEnhancedTx({
      tx,
      mint: MINT,
      poolHint: POOL,
      lastKnownMcUsd: 33_200,
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.swap.eventKind, 'remove_liq');
    assert.equal(parsed.swap.marketCapUsd, 33_200);
    assert.ok(parsed.swap.solAmount >= 300);
  });

  it('still skips unrelated non-swap types', () => {
    const tx: HeliusEnhancedTx = {
      signature: 'nft1',
      feePayer: 'wallet',
      type: 'NFT_SALE',
      tokenTransfers: [{ mint: MINT, tokenAmount: 1, fromUserAccount: 'a', toUserAccount: 'b' }],
    };
    const parsed = parseSwapFromEnhancedTx({ tx, mint: MINT, poolHint: POOL });
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.match(parsed.reason, /skip_type/);
  });
});
