import { NextResponse, type NextRequest } from 'next/server';

/**
 * CORS for the API so non-web Pointer clients (the Chrome extension) can call it
 * cross-origin. Allowlist only — the web app's own origin plus any configured
 * extension origins. Same-origin requests carry no `Origin` header and are left
 * untouched; unknown origins get NO CORS headers (browser blocks them, as today).
 * Fail-safe: any error falls through to the normal response.
 *
 * Set `POINTER_EXTENSION_ORIGINS` (comma-separated `chrome-extension://<id>`) when
 * the extension exists; until then this changes nothing for existing traffic.
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

export function middleware(req: NextRequest) {
  try {
    const origin = req.headers.get('origin');
    if (!origin) return NextResponse.next(); // same-origin / server-to-server
    // The TonConnect manifest sets its own permissive CORS — don't double-handle.
    if (req.nextUrl.pathname.startsWith('/api/tonconnect-manifest')) return NextResponse.next();

    const allowed = allowedOrigins().includes(origin);

    if (req.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: allowed ? corsHeaders(origin) : undefined });
    }

    const res = NextResponse.next();
    if (allowed) {
      for (const [k, v] of Object.entries(corsHeaders(origin))) res.headers.set(k, v);
    }
    return res;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: '/api/:path*',
};
