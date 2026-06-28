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

/**
 * CORS allowlist for the API so non-web Pointer clients (the Chrome extension)
 * can call it cross-origin. Allowlist only — the web app's own origin plus any
 * configured extension origins. Same-origin requests carry no `Origin` header and
 * are left untouched; unknown origins get NO CORS headers (the browser blocks
 * them, exactly as today). Fail-safe by construction. Set
 * `POINTER_EXTENSION_ORIGINS` (comma-separated `chrome-extension://<id>`) when the
 * extension exists; until then this changes nothing for existing traffic.
 */
function allowedOrigins(): string[] {
  const out: string[] = [];
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (app) out.push(app.replace(/\/+$/, ''));
  const ext = process.env.POINTER_EXTENSION_ORIGINS?.trim();
  if (ext) for (const o of ext.split(',').map((s) => s.trim()).filter(Boolean)) out.push(o);
  if (process.env.NODE_ENV !== 'production') {
    out.push('http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:3000');
  }
  return out;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Pointer-Client',
    'Access-Control-Allow-Credentials': 'false',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Attach CORS headers to an existing response for an allowed cross-origin API call. */
function withCors(res: NextResponse, origin: string | null): NextResponse {
  if (origin) for (const [k, v] of Object.entries(corsHeaders(origin))) res.headers.set(k, v);
  return res;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  /** Clean invite URLs: `/@CODE` → `/points?tab=referral&code=CODE` (browser bar stays `/@CODE`). */
  const invite = pathname.match(/^\/@([a-zA-Z0-9_-]{2,64})\/?$/);
  if (invite?.[1]) {
    const url = request.nextUrl.clone();
    url.pathname = '/points';
    url.searchParams.set('tab', 'referral');
    url.searchParams.set('code', invite[1]);
    return NextResponse.rewrite(url);
  }

  // Resolve the cross-origin API caller (if any) once. Same-origin requests send
  // no Origin header → corsOrigin stays null and nothing below changes.
  const origin = request.headers.get('origin');
  const isApi = pathname.startsWith('/api');
  const corsOrigin =
    origin &&
    isApi &&
    !pathname.startsWith('/api/tonconnect-manifest') &&
    allowedOrigins().includes(origin)
      ? origin
      : null;

  // CORS preflight short-circuits BEFORE rate-limit / session / beta gate — a
  // bare OPTIONS carries no cookies and shouldn't be gated or counted.
  if (request.method === 'OPTIONS' && isApi) {
    return new NextResponse(null, {
      status: 204,
      headers: corsOrigin ? corsHeaders(corsOrigin) : undefined,
    });
  }

  const rl = await enforcePublicApiRateLimit(request);
  if (rl) return withCors(rl, corsOrigin);

  const sessionResponse = await updateSession(request);
  const gated = await applyBetaGate(request, sessionResponse);
  return withCors(gated, corsOrigin);
}

export const config = {
  matcher: [
    // Skip static assets, favicon, and image optimization. Match everything else.
    // Skip TonConnect manifest so wallet extensions get JSON, not a beta redirect HTML page.
    '/((?!_next/static|_next/image|favicon.ico|tonconnect-manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
