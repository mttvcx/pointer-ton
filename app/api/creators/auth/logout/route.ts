import { NextResponse } from 'next/server';
import { clearCreatorSessionCookieOptions } from '@/lib/creators/session';

export const runtime = 'nodejs';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearCreatorSessionCookieOptions());
  return res;
}
