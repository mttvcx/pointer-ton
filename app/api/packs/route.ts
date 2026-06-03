import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { listPublicPackConfigs } from '@/lib/packs/packConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ packs: listPublicPackConfigs() });
}
