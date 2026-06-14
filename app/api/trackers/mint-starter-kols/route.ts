import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { APP_CHAIN_IDS, isAppChainId, type AppChainId } from '@/lib/chains/appChain';
import { mintStarterKolPackForUser } from '@/lib/db/mintStarterKolPack';
import { getUserByPrivyId } from '@/lib/db/users';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { chainSupportsStarterKolMint } from '@/lib/track/starterKolPacks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    appChain: z.enum(APP_CHAIN_IDS as unknown as [AppChainId, ...AppChainId[]]),
  })
  .strict();

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
    return NextResponse.json(
      { error: 'user_not_synced', message: 'Call /api/auth/sync first' },
      { status: 403 },
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  if (!isAppChainId(body.appChain) || !chainSupportsStarterKolMint(body.appChain)) {
    return NextResponse.json({ error: 'unsupported_chain' }, { status: 400 });
  }

  try {
    const result = await mintStarterKolPackForUser(user.id, body.appChain);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'mint_failed';
    return NextResponse.json({ error: 'mint_failed', message }, { status: 500 });
  }
}
