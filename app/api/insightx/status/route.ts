import { NextResponse } from 'next/server';
import { insightxConfigured } from '@/lib/insightx/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cheap check the UI uses to decide whether InsightX features are live. */
export async function GET() {
  return NextResponse.json({ configured: insightxConfigured() });
}
