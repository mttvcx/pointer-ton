import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import { getCommitment, rotateSeed, setClientSeed } from '@/lib/packs/fairnessSeeds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Current provably-fair commitment for the signed-in user (the hash the next
 *  roll commits to + the client seed + the next nonce). */
export async function GET(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ commitment: await getCommitment(auth.user.id) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'fairness_unavailable';
    return NextResponse.json({ error: 'fairness_unavailable', message }, { status: 503 });
  }
}

const Body = z
  .object({
    action: z.enum(['setClientSeed', 'rotate']),
    clientSeed: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

/**
 * `setClientSeed` — set the player's own entropy (the server commitment is what
 * prevents grinding, so this only adds the player's seed).
 * `rotate` — REVEAL the current server seed (so past rolls become verifiable) and
 * commit a fresh pair. Returns the revealed proof + the new commitment.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  try {
    if (body.action === 'setClientSeed') {
      if (!body.clientSeed) {
        return NextResponse.json({ error: 'client_seed_required' }, { status: 400 });
      }
      return NextResponse.json({ commitment: await setClientSeed(auth.user.id, body.clientSeed) });
    }
    // rotate
    const { revealed, next } = await rotateSeed(auth.user.id, body.clientSeed);
    return NextResponse.json({ revealed, commitment: next });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'fairness_error';
    return NextResponse.json({ error: 'fairness_error', message }, { status: 500 });
  }
}
