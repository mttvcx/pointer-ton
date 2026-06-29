import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  createFairRng,
  generateClientSeed,
  generateServerSeed,
  hashServerSeed,
  verifyServerSeed,
} from '@/lib/packs/provablyFair';

describe('provablyFair: commitment hashing', () => {
  it('hashServerSeed matches a known sha256 vector', () => {
    const seed = 'abc';
    const expected = createHash('sha256').update(seed).digest('hex');
    assert.equal(hashServerSeed(seed), expected);
  });

  it('verifyServerSeed accepts the pre-image and rejects others', () => {
    const seed = generateServerSeed();
    const hash = hashServerSeed(seed);
    assert.equal(verifyServerSeed(seed, hash), true);
    assert.equal(verifyServerSeed(seed, hash.toUpperCase()), true); // case-insensitive
    assert.equal(verifyServerSeed(generateServerSeed(), hash), false);
  });

  it('generated seeds are 32-byte / 16-byte hex', () => {
    assert.match(generateServerSeed(), /^[0-9a-f]{64}$/);
    assert.match(generateClientSeed(), /^[0-9a-f]{32}$/);
  });
});

describe('provablyFair: createFairRng', () => {
  it('is deterministic for identical (serverSeed, clientSeed, nonce)', () => {
    const a = createFairRng('server', 'client', 7);
    const b = createFairRng('server', 'client', 7);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    assert.deepEqual(seqA, seqB);
  });

  it('all draws are in [0,1)', () => {
    const rng = createFairRng('s', 'c', 0);
    for (let i = 0; i < 1000; i++) {
      const x = rng();
      assert.ok(x >= 0 && x < 1, `out of range: ${x}`);
    }
  });

  it('different nonce / clientSeed / serverSeed produce different streams', () => {
    const base = createFairRng('s', 'c', 0)();
    assert.notEqual(base, createFairRng('s', 'c', 1)());
    assert.notEqual(base, createFairRng('s', 'd', 0)());
    assert.notEqual(base, createFairRng('t', 'c', 0)());
  });

  it('crosses HMAC block boundaries deterministically (>8 draws)', () => {
    // 8 uint32 per 32-byte block; 50 draws spans ~7 blocks.
    const a = Array.from({ length: 50 }, ((r) => () => r())(createFairRng('s', 'c', 3)));
    const b = Array.from({ length: 50 }, ((r) => () => r())(createFairRng('s', 'c', 3)));
    assert.deepEqual(a, b);
    // not all equal to the first draw (stream actually advances)
    assert.ok(new Set(a).size > 40);
  });

  it('mean of many draws is ~0.5 (uniformity sanity)', () => {
    const rng = createFairRng(generateServerSeed(), 'client', 0);
    let sum = 0;
    const n = 20_000;
    for (let i = 0; i < n; i++) sum += rng();
    const mean = sum / n;
    assert.ok(Math.abs(mean - 0.5) < 0.02, `mean=${mean}`);
  });

  it('a verifier can replay an outcome from the revealed seed', () => {
    // Simulate: server commits hash, rolls, later reveals seed; verifier replays.
    const serverSeed = generateServerSeed();
    const commitment = hashServerSeed(serverSeed);
    const clientSeed = 'player-chosen';
    const nonce = 42;

    const rolled = Array.from({ length: 10 }, ((r) => () => r())(createFairRng(serverSeed, clientSeed, nonce)));

    // verifier only trusts the revealed seed if it matches the commitment
    assert.equal(verifyServerSeed(serverSeed, commitment), true);
    const replayed = Array.from({ length: 10 }, ((r) => () => r())(createFairRng(serverSeed, clientSeed, nonce)));
    assert.deepEqual(replayed, rolled);
  });
});
