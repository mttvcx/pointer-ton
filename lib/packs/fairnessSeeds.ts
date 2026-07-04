import 'server-only';

import { getRedis } from '@/lib/redis/client';
import {
  generateClientSeed,
  generateServerSeed,
  hashServerSeed,
  type FairnessCommitment,
  type FairnessProof,
} from '@/lib/packs/provablyFair';

/**
 * Per-user provably-fair seed lifecycle (Redis I/O over the pure core).
 *
 * A user has ONE active seed pair at a time: a secret `serverSeed` (only its hash
 * is public) and a `clientSeed` (the user may set their own). Each roll consumes
 * the next `nonce` (atomic INCR). To verify, the user rotates: the old serverSeed
 * is revealed and a fresh pair is committed. The seed blob has no TTL — it must
 * survive until the user rotates, or past opens become unverifiable.
 */

type SeedBlob = { serverSeed: string; serverSeedHash: string; clientSeed: string };

const blobKey = (userId: string) => `packs:fair:${userId}`;
const nonceKey = (userId: string) => `packs:fair:nonce:${userId}`;

async function readBlob(userId: string): Promise<SeedBlob | null> {
  const raw = await getRedis().get<string | SeedBlob>(blobKey(userId));
  if (raw == null) return null;
  return typeof raw === 'string' ? (JSON.parse(raw) as SeedBlob) : raw;
}

async function writeBlob(userId: string, blob: SeedBlob): Promise<void> {
  await getRedis().set(blobKey(userId), JSON.stringify(blob));
}

function freshBlob(clientSeed?: string): SeedBlob {
  const serverSeed = generateServerSeed();
  return {
    serverSeed,
    serverSeedHash: hashServerSeed(serverSeed),
    clientSeed: clientSeed?.trim() || generateClientSeed(),
  };
}

async function ensureBlob(userId: string): Promise<SeedBlob> {
  const existing = await readBlob(userId);
  if (existing) return existing;
  const blob = freshBlob();
  await writeBlob(userId, blob);
  return blob;
}

/** The user's current public commitment + the nonce the NEXT roll will use. */
export async function getCommitment(userId: string): Promise<FairnessCommitment> {
  const blob = await ensureBlob(userId);
  const current = Number(await getRedis().get<number>(nonceKey(userId))) || 0;
  return { serverSeedHash: blob.serverSeedHash, clientSeed: blob.clientSeed, nonce: current + 1 };
}

/**
 * Reserve the next roll: atomically claim a unique nonce and return everything
 * the roll needs. The serverSeed is returned for the roll computation only — the
 * caller must NOT expose it (only its hash goes to the client until rotation).
 */
export async function reserveRoll(userId: string): Promise<{
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}> {
  const blob = await ensureBlob(userId);
  const nonce = await getRedis().incr(nonceKey(userId)); // atomic, unique
  return { serverSeed: blob.serverSeed, serverSeedHash: blob.serverSeedHash, clientSeed: blob.clientSeed, nonce };
}

/** Set the user's client seed (allowed any time; the server commitment is what
 *  prevents grinding, so a client-chosen seed only adds the player's entropy). */
export async function setClientSeed(userId: string, clientSeed: string): Promise<FairnessCommitment> {
  const trimmed = clientSeed.trim().slice(0, 128);
  if (!trimmed) throw new Error('empty_client_seed');
  const blob = await ensureBlob(userId);
  await writeBlob(userId, { ...blob, clientSeed: trimmed });
  const current = Number(await getRedis().get<number>(nonceKey(userId))) || 0;
  return { serverSeedHash: blob.serverSeedHash, clientSeed: trimmed, nonce: current + 1 };
}

/**
 * Rotate: REVEAL the active serverSeed (so past rolls become verifiable) and
 * commit a fresh pair. Returns the revealed proof for the just-closed seed plus
 * the new commitment. Resets the nonce.
 */
export async function rotateSeed(
  userId: string,
  newClientSeed?: string,
): Promise<{ revealed: FairnessProof; next: FairnessCommitment }> {
  const blob = await ensureBlob(userId);
  const finalNonce = Number(await getRedis().get<number>(nonceKey(userId))) || 0;

  const next = freshBlob(newClientSeed || blob.clientSeed);
  await writeBlob(userId, next);
  await getRedis().del(nonceKey(userId)); // nonce restarts at 0 → first roll uses 1

  return {
    revealed: {
      serverSeed: blob.serverSeed,
      serverSeedHash: blob.serverSeedHash,
      clientSeed: blob.clientSeed,
      nonce: finalNonce,
    },
    next: { serverSeedHash: next.serverSeedHash, clientSeed: next.clientSeed, nonce: 1 },
  };
}
