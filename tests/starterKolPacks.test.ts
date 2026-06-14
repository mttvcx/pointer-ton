import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  chainSupportsStarterKolMint,
  starterKolEntriesForChain,
} from '@/lib/track/starterKolPacks';

describe('starter KOL packs', () => {
  it('supports sol and evm chains only', () => {
    assert.equal(chainSupportsStarterKolMint('sol'), true);
    assert.equal(chainSupportsStarterKolMint('eth'), true);
    assert.equal(chainSupportsStarterKolMint('bnb'), true);
    assert.equal(chainSupportsStarterKolMint('base'), true);
    assert.equal(chainSupportsStarterKolMint('ton'), false);
  });

  it('loads deduped SOL KOL pack from committed seeds', () => {
    const rows = starterKolEntriesForChain('sol');
    assert.ok(rows.length >= 40);
    const addrs = new Set(rows.map((r) => r.wallet.toLowerCase()));
    assert.equal(addrs.size, rows.length);
    assert.ok(rows.some((r) => r.name === 'Cented'));
    assert.ok(rows.some((r) => r.name === 'dvces'));
  });

  it('uses same 20 EVM wallets for eth, bnb, and base', () => {
    const eth = starterKolEntriesForChain('eth');
    const bnb = starterKolEntriesForChain('bnb');
    const base = starterKolEntriesForChain('base');
    assert.equal(eth.length, 20);
    assert.equal(bnb.length, 20);
    assert.equal(base.length, 20);
    assert.deepEqual(
      eth.map((r) => r.wallet.toLowerCase()),
      bnb.map((r) => r.wallet.toLowerCase()),
    );
  });
});
