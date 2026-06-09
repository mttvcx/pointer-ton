import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  coerceHeliusEnhancedTx,
  emptyQaIngestReport,
  txTouchesQaMint,
} from '@/lib/indexer/qaMintIngest';
import { DEFAULT_POINTER_QA_MINT } from '@/lib/qa/pointerQaMintClient';

describe('coerceHeliusEnhancedTx', () => {
  it('returns null for non-objects', () => {
    assert.equal(coerceHeliusEnhancedTx(null), null);
    assert.equal(coerceHeliusEnhancedTx('x'), null);
  });

  it('maps webhook fields', () => {
    const tx = coerceHeliusEnhancedTx({
      signature: 'abc123',
      timestamp: 1_700_000_000,
      feePayer: 'Wallet111',
      type: 'SWAP',
      tokenTransfers: [{ mint: DEFAULT_POINTER_QA_MINT, tokenAmount: 100 }],
    });
    assert.ok(tx);
    assert.equal(tx?.signature, 'abc123');
    assert.equal(tx?.feePayer, 'Wallet111');
  });
});

describe('txTouchesQaMint', () => {
  it('is false when mint transfer missing', () => {
    assert.equal(
      txTouchesQaMint({ tokenTransfers: [{ mint: 'OtherMint', tokenAmount: 1 }] }, DEFAULT_POINTER_QA_MINT),
      false,
    );
  });

  it('is true when QA mint transfer present', () => {
    assert.equal(
      txTouchesQaMint(
        { tokenTransfers: [{ mint: DEFAULT_POINTER_QA_MINT, tokenAmount: 1.5 }] },
        DEFAULT_POINTER_QA_MINT,
      ),
      true,
    );
  });
});

describe('emptyQaIngestReport', () => {
  it('starts at zero counts', () => {
    const r = emptyQaIngestReport(DEFAULT_POINTER_QA_MINT);
    assert.equal(r.swapsInserted, 0);
    assert.equal(r.swapsSkippedDuplicate, 0);
    assert.equal(r.parserFailures, 0);
  });
});
