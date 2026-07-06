import { NextResponse, type NextRequest } from 'next/server';
import { getSibylUsage, sibylUserId } from '@/sibyl/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/sibyl/usage — today's usage for the signed-in user (or the anonymous
 * FREE session). Drives the "X / cap scans left today" meter in the UI. Guests
 * always read 0 used (nothing is attributed to them server-side).
 */
export async function GET(req: NextRequest) {
  const userId = await sibylUserId(req);
  const u = await getSibylUsage(userId);
  return NextResponse.json({
    authenticated: Boolean(userId),
    tier: u.tier,
    tokenUsage: u.tokenUsage,
    used: u.used,
    cap: u.cap, // 0 = unlimited
    remaining: u.remaining === Infinity ? null : u.remaining,
    overCap: u.overCap,
    resetAt: u.resetAtIso,
  });
}
