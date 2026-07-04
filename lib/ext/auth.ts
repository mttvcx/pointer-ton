import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { getRedis } from '@/lib/redis/client';
import { verifyExtToken, type VerifiedExt } from '@/lib/ext/token';

/**
 * Guard for every `/api/ext/*` data route. Verifies the scoped extension token
 * (signature + family liveness = instant revoke) and applies a per-user rate
 * limit so a noisy install can't hammer the paid upstreams the facade fronts.
 *
 * Returns the verified identity on success, or a ready-to-return NextResponse on
 * failure: `const a = await requireExtAuth(req); if ('response' in a) return a.response;`
 */

const RL_PER_MIN = Number(process.env.EXT_RATE_LIMIT_PER_MIN || 120);

function bearer(req: NextRequest): string | null {
  const h = req.headers.get('authorization');
  return h?.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

async function rateLimited(userId: string): Promise<boolean> {
  try {
    const minute = Math.floor(Date.now() / 60_000);
    const key = `ext:rl:${userId}:${minute}`;
    const n = await getRedis().incr(key);
    if (n === 1) await getRedis().expire(key, 65);
    return n > RL_PER_MIN;
  } catch {
    return false; // never block a read on a Redis blip
  }
}

export type ExtAuthResult = VerifiedExt | { response: NextResponse };

export async function requireExtAuth(req: NextRequest): Promise<ExtAuthResult> {
  const token = bearer(req);
  if (!token) {
    return { response: NextResponse.json({ error: 'not_connected' }, { status: 401 }) };
  }
  let verified: VerifiedExt;
  try {
    verified = await verifyExtToken(token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'invalid_token';
    const code = msg === 'revoked' ? 'revoked' : 'invalid_token';
    return { response: NextResponse.json({ error: code }, { status: 401 }) };
  }
  if (await rateLimited(verified.userId)) {
    return {
      response: NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': '30' } },
      ),
    };
  }
  return verified;
}
