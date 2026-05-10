import { NextResponse } from 'next/server';
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
  /** Clean invite URLs: `/@CODE` → `/points?tab=referral&code=CODE` (browser bar stays `/@CODE`). */
  const pathname = request.nextUrl.pathname;
  const invite = pathname.match(/^\/@([a-zA-Z0-9_-]{2,64})\/?$/);
  if (invite?.[1]) {
    const url = request.nextUrl.clone();
    url.pathname = '/points';
    url.searchParams.set('tab', 'referral');
    url.searchParams.set('code', invite[1]);
    return NextResponse.rewrite(url);
  }

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
