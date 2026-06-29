import { NextResponse } from 'next/server';
import { publicStatus } from '@/lib/emergency/controls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public, non-sensitive emergency status — drives the client banner + the
 *  maintenance/read-only UI. No auth (it's shown to everyone). */
export async function GET() {
  try {
    const status = await publicStatus();
    return NextResponse.json(status, {
      headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' },
    });
  } catch {
    // Never fail the banner fetch — absence of a banner is the safe default.
    return NextResponse.json({ maintenance: false, readOnly: false, banner: null });
  }
}
