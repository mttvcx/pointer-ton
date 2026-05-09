import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  deleteAllTrackedWalletsForUser,
  deleteTrackedWallet,
  deleteTrackedWalletsForUserChain,
  getTrackedWallet,
  listTrackedWalletsForUser,
  updateTrackedWalletNotify,
  upsertTrackedWallet,
} from '@/lib/db/wallets';
import { getUserByPrivyId } from '@/lib/db/users';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { enrichTrackedWalletAddresses } from '@/lib/trackers/enrichAddresses';
import type { AppChainId } from '@/lib/chains/appChain';
import { isAppChainId } from '@/lib/chains/appChain';
import { inferMintKind, mintMatchesAppChain } from '@/lib/chains/mintKind';
import { normalizeWalletAddressForStorage } from '@/lib/wallets/addressNormalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AppChainEnum = z.enum(['sol', 'ton', 'bnb', 'base']);

const PatchBodySchema = z
  .object({
    walletAddress: z.string().min(1),
    notify: z.boolean(),
  })
  .strict()
  .refine((b) => inferMintKind(b.walletAddress.trim()) !== 'unknown', {
    message: 'invalid_wallet_address',
  });

const PostBodySchema = z
  .object({
    walletAddress: z.string().min(1),
    label: z.string().trim().max(64).optional().nullable(),
    appChain: AppChainEnum,
  })
  .strict()
  .refine((b) => mintMatchesAppChain(b.walletAddress, b.appChain as AppChainId), {
    message: 'address_chain_mismatch',
  });

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

  const rowsAll = await listTrackedWalletsForUser(user.id);
  const chainParam = req.nextUrl.searchParams.get('app_chain');
  const rows =
    chainParam && isAppChainId(chainParam)
      ? rowsAll.filter((r) => mintMatchesAppChain(r.wallet_address, chainParam))
      : rowsAll;
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

  const tonOnly = rows.filter((r) => inferMintKind(r.wallet_address) === 'ton');
  const tonEnrichment =
    tonOnly.length > 0 ? await enrichTrackedWalletAddresses(tonOnly.map((r) => r.wallet_address)) : {};
  const enrichment: Record<string, { nanoTon: string | null; lastActiveUnix: number | null }> = {};
  for (const r of rows) {
    const k = r.wallet_address;
    if (inferMintKind(k) === 'ton') {
      enrichment[k] = tonEnrichment[k] ?? { nanoTon: null, lastActiveUnix: null };
    } else {
      enrichment[k] = { nanoTon: null, lastActiveUnix: null };
    }
  }
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
    const norm = normalizeWalletAddressForStorage(body.walletAddress);
    if (!norm) {
      return NextResponse.json({ error: 'invalid_wallet_address' }, { status: 400 });
    }

    const existing = await getTrackedWallet(user.id, norm);
    const row = await upsertTrackedWallet({
      user_id: user.id,
      wallet_address: norm,
      label: body.label ?? null,
      notify: true,
    });
    if (!existing) {
      try {
        const { awardPoints } = await import('@/lib/points/award');
        await awardPoints(user.id, 'tracker_setup', {
          dedupeKey: `tracker_wallet:${norm}`,
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
    const norm = normalizeWalletAddressForStorage(body.walletAddress);
    if (!norm) {
      return NextResponse.json({ error: 'invalid_wallet_address' }, { status: 400 });
    }

    const exists = await getTrackedWallet(user.id, norm);
    if (!exists) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const row = await updateTrackedWalletNotify(user.id, norm, body.notify);
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
      const chainParam = req.nextUrl.searchParams.get('app_chain');
      if (chainParam && isAppChainId(chainParam)) {
        await deleteTrackedWalletsForUserChain(user.id, chainParam);
      } else {
        await deleteAllTrackedWalletsForUser(user.id);
      }
      return NextResponse.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'delete_failed';
      return NextResponse.json({ error: 'delete_failed', message }, { status: 500 });
    }
  }

  const raw = req.nextUrl.searchParams.get('address')?.trim() ?? '';
  const address = raw ? normalizeWalletAddressForStorage(raw) : null;
  if (!address || inferMintKind(address) === 'unknown') {
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
