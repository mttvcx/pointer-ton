import { NextResponse, type NextRequest } from 'next/server';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import {
  solMinDeposit,
  splitnowConfigured,
  splitnowGetDepositLimits,
} from '@/lib/splitnow/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) return null;
  try {
    await verifyPrivyAccessToken(accessToken);
    return true;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!splitnowConfigured()) {
    return NextResponse.json({ configured: false, minSol: 0.06 });
  }
  try {
    const limits = await splitnowGetDepositLimits();
    const minSol = solMinDeposit(limits) ?? 0.06;
    return NextResponse.json({ configured: true, minSol, limits });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'splitnow_limits_failed';
    return NextResponse.json({ error: message, configured: true, minSol: 0.06 }, { status: 502 });
  }
}
