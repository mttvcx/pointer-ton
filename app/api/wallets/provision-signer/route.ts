import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserByPrivyId } from '@/lib/db/users';
import { upsertWalletSignerProvision } from '@/lib/db/walletSignerProvisions';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { getServerWalletRescueStatus } from '@/lib/privy/serverWalletSign';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    walletAddress: z.string().min(32),
    privyWalletId: z.string().optional(),
  })
  .strict();

/** Record that the client attached Pointer's server signer to an embedded wallet. */
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

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  const status = await getServerWalletRescueStatus(body.walletAddress);
  const row = await upsertWalletSignerProvision({
    userId: user.id,
    walletAddress: body.walletAddress,
    privyWalletId: body.privyWalletId ?? status.walletId,
    status: status.hasAppSigner ? 'active' : 'failed',
  });

  return NextResponse.json({
    provision: row,
    rescue: status,
  });
}
