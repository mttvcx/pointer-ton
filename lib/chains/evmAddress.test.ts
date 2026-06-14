import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evmAddressesMatch, normalizeEvmAddress, resolveCanonicalEvmMint } from '@/lib/chains/evmAddress';

describe('evmAddress', () => {
  it('normalizes to lowercase', () => {
    assert.equal(
      normalizeEvmAddress('0x6982508145454Ce325ddBe47A25d4ec3D2311933'),
      '0x6982508145454ce325ddbe47a25d4ec3d2311933',
    );
  });

  it('matches checksummed vs lowercase', () => {
    assert.ok(
      evmAddressesMatch(
        '0x6982508145454Ce325ddBe47A25d4ec3D2311933',
        '0x6982508145454ce325ddbe47a25d4ec3d2311933',
      ),
    );
  });

  it('resolveCanonicalEvmMint returns db mint', () => {
    const db = '0x6982508145454ce325ddbe47a25d4ec3d2311933';
    assert.equal(
      resolveCanonicalEvmMint('0x6982508145454Ce325ddBe47A25d4ec3D2311933', [db]),
      db,
    );
  });
});
