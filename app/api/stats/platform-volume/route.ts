import { NextResponse } from 'next/server';
import { sumConfirmedTradeVolumeSolUtcToday } from '@/lib/db/trades';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const volumeSolToday = await sumConfirmedTradeVolumeSolUtcToday();
    return NextResponse.json({ volumeSolToday });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message, volumeSolToday: 0 }, { status: 500 });
  }
}
