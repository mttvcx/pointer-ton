import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePointerUser } from '@/lib/api/privyUser';
import {
  listWalletLabelsForUser,
  upsertWalletLabel,
  type WalletLabelRow,
} from '@/lib/db/walletLabels';
import { isValidPublicKey } from '@/lib/utils/addresses';

const postSchema = z.object({
  walletAddress: z.string().min(32).max(64),
  label: z.string().trim().min(1).max(64),
  emoji: z.string().max(12).nullable().optional(),
  color: z.enum(['yellow', 'green', 'red', 'blue', 'purple']).optional(),
});

function toDto(r: WalletLabelRow) {
  return {
    walletAddress: r.wallet_address,
    label: r.label,
    emoji: r.emoji,
    color: r.color,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;
  try {
    const rows = await listWalletLabelsForUser(auth.user.id);
    return NextResponse.json({ labels: rows.map(toDto) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'wallet_labels_fetch_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const { walletAddress, label, emoji, color } = parsed.data;
  if (!isValidPublicKey(walletAddress)) {
    return NextResponse.json({ error: 'invalid_wallet_address' }, { status: 400 });
  }

  try {
    const row = await upsertWalletLabel(
      auth.user.id,
      walletAddress,
      label,
      emoji ?? null,
      color ?? 'yellow',
    );
    return NextResponse.json({ label: toDto(row) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'wallet_label_upsert_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
