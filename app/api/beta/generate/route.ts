import { randomBytes } from 'crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isFounderWallet } from '@/lib/beta/founder';
import { hashBetaCode, normalizeBetaCodeInput } from '@/lib/beta/codeHash';
import { insertBetaCodeRow } from '@/lib/db/betaCodes';
import { getUserByPrivyId } from '@/lib/db/users';
import { verifyPrivyAccessToken } from '@/lib/privy/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return NextResponse.json({ error: 'missing_authorization' }, { status: 401 });
  }
  let verified;
  try {
    verified = await verifyPrivyAccessToken(accessToken);
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }
  const user = await getUserByPrivyId(verified.privyId);
  if (!user) {
    return NextResponse.json({ error: 'user_not_synced' }, { status: 403 });
  }
  if (!isFounderWallet(user.wallet_address, process.env.BETA_FOUNDER_WALLETS)) {
    return NextResponse.json({ error: 'forbidden', message: 'Founder wallet only' }, { status: 403 });
  }
  const pepper = process.env.BETA_CODE_PEPPER?.trim();
  if (!pepper) {
    return NextResponse.json({ error: 'server_misconfigured', message: 'BETA_CODE_PEPPER' }, { status: 500 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = z.object({ prefix: z.string().max(8).optional() }).safeParse(body);
  let prefix = 'PTR';
  if (parsed.success && parsed.data.prefix?.trim()) {
    prefix =
      normalizeBetaCodeInput(parsed.data.prefix).replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'PTR';
  }

  const a = randomBytes(2).toString('hex').toUpperCase();
  const b = randomBytes(2).toString('hex').toUpperCase();
  const code = `${prefix}-${a}-${b}`;
  const hash = hashBetaCode(normalizeBetaCodeInput(code), pepper);
  await insertBetaCodeRow(user.id, hash);
  return NextResponse.json({ code });
}
