import { NextResponse, type NextRequest } from 'next/server';
import { requireExtAuth } from '@/lib/ext/auth';
import { getAiAccess } from '@/lib/access/aiAccess';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Extension state sync. Returns only what the facade can VERIFY (never invented).
 * AI access reuses the SAME gate as the app (`getAiAccess`: ≥5 SOL OR active
 * subscription). solBalance / monthlyVolume / scansRemaining are surfaced in
 * Phase 2 (the free-usage model) — null for now.
 */
export async function GET(req: NextRequest) {
  const auth = await requireExtAuth(req);
  if ('response' in auth) return auth.response;

  let aiAccess = false;
  let subscription: 'none' | 'active' | 'founder' = 'none';
  try {
    const decision = await getAiAccess(auth.userId);
    aiAccess = decision.allowed;
    if (decision.basis === 'subscription') subscription = 'active';
  } catch {
    /* degrade to not-allowed rather than fail the sync */
  }

  return NextResponse.json({
    connected: true,
    userId: auth.userId,
    subscription,
    aiAccess,
    solBalance: null,
    monthlyVolumeSol: null,
    scansRemaining: null,
  });
}
