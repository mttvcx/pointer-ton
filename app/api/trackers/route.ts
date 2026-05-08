import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  deleteAllTrackedWalletsForUser,
  deleteTrackedWallet,
  getTrackedWallet,
  listTrackedWalletsForUser,
  updateTrackedWalletNotify,
  upsertTrackedWallet,
} from '@/lib/db/wallets';
import { getUserByPrivyId } from '@/lib/db/users';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { enrichTrackedWalletAddresses } from '@/lib/trackers/enrichAddresses';
import { isValidTonTrackedAddress } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PatchBodySchema = z
  .object({
    walletAddress: z.string().refine(isValidTonTrackedAddress),
    notify: z.boolean(),
  })
  .strict();

const PostBodySchema = z
  .object({
    walletAddress: z.string().refine(isValidTonTrackedAddress),
    label: z.string().trim().max(64).optional().nullable(),
  })
  .strict();

export async function GET(req: NextRequest) {
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

  const rows = await listTrackedWalletsForUser(user.id);
  const trackers = rows.map((r) => ({
    id: r.id,
    walletAddress: r.wallet_address,
    label: r.label,
    notify: r.notify,
    createdAt: r.created_at,
  }));

  const enrich = req.nextUrl.searchParams.get('enrich') === '1';
  if (!enrich || rows.length === 0) {
    return NextResponse.json({ trackers, enrichment: undefined });
  }

  const enrichment = await enrichTrackedWalletAddresses(rows.map((r) => r.wallet_address));
  return NextResponse.json({ trackers, enrichment });
}

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

  let body: z.infer<typeof PostBodySchema>;
  try {
    const json: unknown = await req.json();
    body = PostBodySchema.parse(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  try {
    const existing = await getTrackedWallet(user.id, body.walletAddress);
    const row = await upsertTrackedWallet({
      user_id: user.id,
      wallet_address: body.walletAddress,
      label: body.label ?? null,
      notify: true,
    });
    if (!existing) {
      try {
        const { awardPoints } = await import('@/lib/points/award');
        await awardPoints(user.id, 'tracker_setup', {
          dedupeKey: `tracker_wallet:${body.walletAddress}`,
          metadata: { tracker_id: row.id },
        });
      } catch {
        /* best-effort */
      }
    }
    return NextResponse.json({
      tracker: {
        id: row.id,
        walletAddress: row.wallet_address,
        label: row.label,
        notify: row.notify,
        createdAt: row.created_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'upsert_failed';
    return NextResponse.json({ error: 'upsert_failed', message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
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

  let body: z.infer<typeof PatchBodySchema>;
  try {
    const json: unknown = await req.json();
    body = PatchBodySchema.parse(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  try {
    const exists = await getTrackedWallet(user.id, body.walletAddress);
    if (!exists) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const row = await updateTrackedWalletNotify(user.id, body.walletAddress, body.notify);
    return NextResponse.json({
      tracker: {
        id: row.id,
        walletAddress: row.wallet_address,
        label: row.label,
        notify: row.notify,
        createdAt: row.created_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'patch_failed';
    return NextResponse.json({ error: 'patch_failed', message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
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

  const removeAll = req.nextUrl.searchParams.get('all') === '1';
  if (removeAll) {
    try {
      await deleteAllTrackedWalletsForUser(user.id);
      return NextResponse.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'delete_failed';
      return NextResponse.json({ error: 'delete_failed', message }, { status: 500 });
    }
  }

  const address = req.nextUrl.searchParams.get('address')?.trim() ?? '';
  if (!address || !isValidTonTrackedAddress(address)) {
    return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
  }

  try {
    await deleteTrackedWallet(user.id, address);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'delete_failed';
    return NextResponse.json({ error: 'delete_failed', message }, { status: 500 });
  }
}
