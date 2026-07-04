import { NextResponse, type NextRequest } from 'next/server';
import { requirePointerUser } from '@/lib/api/privyUser';
import { getUserById, getUserByUsername } from '@/lib/db/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/users/resolve?handle=<username> | ?id=<userId>
 * Resolves a Pointer user to their Solana wallet — the recipient side of the P2P
 * send flow. Authed (only signed-in users can look up a recipient). Returns just
 * the public identity + primary wallet, never sensitive fields.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  const url = new URL(req.url);
  const handle = url.searchParams.get('handle');
  const id = url.searchParams.get('id');
  if (!handle && !id) return NextResponse.json({ error: 'handle_or_id_required' }, { status: 400 });

  try {
    const user = id ? await getUserById(id) : await getUserByUsername(handle!);
    if (!user) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (!user.wallet_address) {
      return NextResponse.json({ error: 'no_wallet', userId: user.id, username: user.username ?? null }, { status: 404 });
    }
    return NextResponse.json({
      userId: user.id,
      username: user.username ?? null,
      walletAddress: user.wallet_address,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'resolve_failed' }, { status: 500 });
  }
}
