import { NextResponse, type NextRequest } from 'next/server';
import { pathIsBetaPublic } from '@/lib/beta/paths';
import { BETA_COOKIE_NAME, verifyBetaSessionCookie } from '@/lib/beta/session-cookie';

export async function applyBetaGate(
  request: NextRequest,
  sessionResponse: NextResponse,
): Promise<NextResponse> {
  if (process.env.BETA_GATE_ENABLED !== 'true') {
    return sessionResponse;
  }
  const pathname = request.nextUrl.pathname;
  if (pathIsBetaPublic(pathname)) {
    return sessionResponse;
  }
  const secret = process.env.BETA_SESSION_SECRET?.trim() ?? '';
  if (!secret) {
    console.warn('[beta] BETA_GATE_ENABLED is true but BETA_SESSION_SECRET is empty; allowing request');
    return sessionResponse;
  }
  const raw = request.cookies.get(BETA_COOKIE_NAME)?.value;
  const ok = await verifyBetaSessionCookie(raw, secret);
  if (ok) return sessionResponse;

  const url = request.nextUrl.clone();
  url.pathname = '/beta';
  url.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}
