import { NextResponse, type NextRequest } from 'next/server';
import { requirePointerUser } from '@/lib/api/privyUser';
import { deleteWalletLabel } from '@/lib/db/walletLabels';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ address: string }> },
) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  const { address: raw } = await ctx.params;
  const walletAddress = decodeURIComponent(raw).trim();
  if (!isValidPublicKey(walletAddress)) {
    return NextResponse.json({ error: 'invalid_wallet_address' }, { status: 400 });
  }

  try {
    await deleteWalletLabel(auth.user.id, walletAddress);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'wallet_label_delete_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
