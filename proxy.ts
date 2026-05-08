import type { NextRequest } from 'next/server';
import { applyBetaGate } from '@/lib/beta/middleware';
import { enforcePublicApiRateLimit } from '@/lib/rate-limit/publicEdge';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Next 16 renamed `middleware` to `proxy`. Same edge-runtime contract;
 * runs ahead of every matched request and is the right place to refresh
 * Supabase session cookies (see `lib/supabase/middleware.ts`).
 */
export async function proxy(request: NextRequest) {
  const rl = await enforcePublicApiRateLimit(request);
  if (rl) return rl;

  const sessionResponse = await updateSession(request);
  return applyBetaGate(request, sessionResponse);
}

export const config = {
  matcher: [
    // Skip static assets, favicon, and image optimization. Match everything else.
    // Skip TonConnect manifest so wallet extensions get JSON, not a beta redirect HTML page.
    '/((?!_next/static|_next/image|favicon.ico|tonconnect-manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
