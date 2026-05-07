import { NextResponse, type NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Unauthenticated reads that are cheap to abuse (scraping / RPC amplification).
 * Authenticated routes already carry user cost; cron/webhooks use separate auth.
 */
export function isPublicApiRateLimitPath(pathname: string): boolean {
  if (pathname === '/api/prices/tickers') return true;
  if (pathname === '/api/stats/platform-volume') return true;
  if (pathname === '/api/push/vapid-public-key') return true;
  if (pathname.startsWith('/api/resolve-address')) return true;
  if (pathname.startsWith('/api/tokens/')) return true;
  return false;
}

let _limiter: Ratelimit | null | undefined;

function getPublicLimiter(): Ratelimit | null {
  if (_limiter !== undefined) return _limiter;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    _limiter = null;
    return _limiter;
  }
  const redis = new Redis({ url, token });
  _limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      Number(process.env.PUBLIC_API_RATE_LIMIT_PER_MIN ?? '120') || 120,
      '60 s',
    ),
    prefix: 'rl:pointer:public-api',
  });
  return _limiter;
}

export function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    request.headers.get('cf-connecting-ip')?.trim() ||
    'anon'
  );
}

/** @returns 429 NextResponse, or null to continue the proxy chain. */
export async function enforcePublicApiRateLimit(
  request: NextRequest,
): Promise<NextResponse | null> {
  if (request.method === 'OPTIONS') return null;
  if (!isPublicApiRateLimitPath(request.nextUrl.pathname)) return null;

  const limiter = getPublicLimiter();
  if (!limiter) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[rate-limit] Upstash Redis not configured; public API rate limit skipped');
    }
    return null;
  }

  const ip = clientIp(request);
  const { success, reset } = await limiter.limit(ip);

  if (success) return null;

  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return NextResponse.json(
    { error: 'rate_limited', message: 'Too many requests. Try again shortly.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'Cache-Control': 'no-store',
      },
    },
  );
}
