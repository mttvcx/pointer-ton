import { type NextRequest, NextResponse } from 'next/server';

function requestPublicOrigin(request: NextRequest): string {
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    request.headers.get('host')?.trim();
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto =
    forwardedProto ||
    (request.nextUrl.protocol === 'https:' ? 'https' : 'http');
  if (host) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

/**
 * TonConnect app manifest. Wallet extensions fetch this URL (often
 * `/tonconnect-manifest.json`). We derive `url` + `iconUrl` from the incoming
 * request origin so localhost vs 127.0.0.1 matches the browser tab (fixes
 * Tonkeeper "Failed to load Manifest: 404" / domain mismatch).
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function GET(request: NextRequest) {
  const origin = requestPublicOrigin(request);
  const body = {
    url: origin,
    name: 'Pointer TON',
    iconUrl: `${origin}/branding/logo.svg`,
  };
  const res = NextResponse.json(body);
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  return res;
}
