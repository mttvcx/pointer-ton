import { NextResponse, type NextRequest } from 'next/server';
import { requirePointerUser } from '@/lib/api/privyUser';
import { revokeSessionsForSubject } from '@/lib/auth/revocation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Log out everywhere: record a revocation cutoff so every session token for this
 * user issued before now is rejected at verify time. The client should also drop
 * its stored token. Best-effort server-side (fail-open) and returns ok regardless
 * so sign-out always completes for the user.
 */
export async function POST(req: NextRequest) {
  const r = await requirePointerUser(req);
  if ('error' in r) return r.error;
  await revokeSessionsForSubject(r.user.privy_id);
  return NextResponse.json({ ok: true });
}
