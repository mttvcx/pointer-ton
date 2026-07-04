import { createHash, createHmac, randomBytes } from 'node:crypto';

/**
 * Provably-fair pack rolls — pure cryptographic core (node:crypto only, no app
 * I/O, fully unit-testable). The seed lifecycle (I/O) lives in `fairnessSeeds.ts`
 * and the roll integration in `openPack.ts`.
 *
 * Scheme (the same commit-reveal model used by audited gaming platforms):
 *
 *   1. The server generates a 32-byte `serverSeed` and publishes only
 *      `serverSeedHash = sha256(serverSeed)` BEFORE any roll (the commitment) —
 *      it cannot change the seed afterwards without breaking the hash.
 *   2. The player has a `clientSeed` (they may set their own) and an
 *      incrementing `nonce` (one per roll against the committed seed).
 *   3. Every random draw comes from an HMAC-SHA256(serverSeed, `clientSeed:nonce:counter`)
 *      keystream — deterministic given (serverSeed, clientSeed, nonce).
 *   4. When the player wants to verify, they rotate the seed: the server REVEALS
 *      the old `serverSeed`. Anyone can then check sha256(serverSeed) == the
 *      previously-published hash and replay every roll to confirm the outcome.
 *
 * Because the server commits to `serverSeedHash` before it knows how the roll
 * will be used (and cannot alter the seed without detection), it cannot grind
 * outcomes; because the keystream is deterministic, the player can reproduce them.
 */

export type FairnessCommitment = {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
};

/** Full proof revealed after rotation — enough to independently verify a roll. */
export type FairnessProof = FairnessCommitment & {
  serverSeed: string;
};

/** 32 cryptographically-random bytes, hex. */
export function generateServerSeed(): string {
  return randomBytes(32).toString('hex');
}

/** Default client seed when the player hasn't set one. */
export function generateClientSeed(): string {
  return randomBytes(16).toString('hex');
}

/** The public commitment to a server seed. */
export function hashServerSeed(serverSeed: string): string {
  return createHash('sha256').update(serverSeed).digest('hex');
}

/** True iff `serverSeed` is the pre-image of `expectedHash`. */
export function verifyServerSeed(serverSeed: string, expectedHash: string): boolean {
  return hashServerSeed(serverSeed) === expectedHash.trim().toLowerCase();
}

/**
 * Deterministic [0,1) generator keyed by (serverSeed, clientSeed, nonce). Yields
 * an unbounded stream: each HMAC-SHA256 block gives 8 uint32 draws; when a block
 * is exhausted the counter advances and a new block is derived. Same inputs →
 * same sequence (this is what makes a roll verifiable).
 */
export function createFairRng(serverSeed: string, clientSeed: string, nonce: number): () => number {
  let counter = 0;
  let buf = Buffer.alloc(0);
  let offset = 0;

  const refill = () => {
    buf = createHmac('sha256', serverSeed).update(`${clientSeed}:${nonce}:${counter}`).digest();
    offset = 0;
    counter += 1;
  };

  return () => {
    if (offset + 4 > buf.length) refill();
    const x = buf.readUInt32BE(offset);
    offset += 4;
    return x / 2 ** 32; // [0, 1)
  };
}
