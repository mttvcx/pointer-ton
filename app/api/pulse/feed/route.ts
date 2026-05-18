import type { NextRequest } from 'next/server';
import { pulseFeedRouteGET } from '@/lib/server/pulseFeedRoute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  return pulseFeedRouteGET(req);
}
