import { NextResponse, type NextRequest } from 'next/server';
import { getUserByPrivyId } from '@/lib/db/users';
import {
  countUserWallets,
  getUserWalletByAddress,
  insertUserWallet,
  setPrimaryUserWallet,
} from '@/lib/db/userWallets';
import { listPrivyEmbeddedWalletsFromUser } from '@/lib/privy/embeddedWallets';
import {
  labelForLinkedSolanaWallet,
  listPrivyLinkedSolanaWalletsFromUser,
} from '@/lib/privy/linkedWallets';
import { getPrivyServerClient, verifyPrivyAccessToken } from '@/lib/privy/config';
import { normalizeWalletAddressForStorage } from '@/lib/wallets/addressNormalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Upserts `user_wallets` for Privy linked Solana + Ethereum wallets.
 * External connectors (Phantom, …) are included so founder manual E2E can trade
 * with the wallet used at login — not only embedded Pointer wallets.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return NextResponse.json({ error: 'missing_authorization' }, { status: 401 });
  }

  let verified: { privyId: string };
  try {
    verified = await verifyPrivyAccessToken(accessToken);
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  const user = await getUserByPrivyId(verified.privyId);
  if (!user) {
    return NextResponse.json({ error: 'user_not_synced' }, { status: 403 });
  }

  try {
    const usersApi = getPrivyServerClient().users();
    let pu = await usersApi._get(verified.privyId);
    let embedded = listPrivyEmbeddedWalletsFromUser(pu);

    if (embedded.length === 0) {
      try {
        await usersApi.pregenerateWallets(verified.privyId, {
          wallets: [{ chain_type: 'solana' }, { chain_type: 'ethereum' }],
        });
        pu = await usersApi._get(verified.privyId);
        embedded = listPrivyEmbeddedWalletsFromUser(pu);
      } catch {
        /* Privy may already have provisioned wallets via dashboard / login */
      }
    }

    let created = 0;
    const n0 = await countUserWallets(user.id);

    const profileWalletRaw =
      user.wallet_address && !user.wallet_address.startsWith('privy:')
        ? user.wallet_address
        : null;
    const profileWallet = profileWalletRaw
      ? normalizeWalletAddressForStorage(profileWalletRaw)
      : null;

    const linkedSol = listPrivyLinkedSolanaWalletsFromUser(pu);
    const orderedSol = [...linkedSol].sort((a, b) => {
      if (a.isEmbedded === b.isEmbedded) return 0;
      return a.isEmbedded ? 1 : -1;
    });

    for (const w of orderedSol) {
      const normalized = normalizeWalletAddressForStorage(w.address);
      if (!normalized) continue;
      const dup = await getUserWalletByAddress(user.id, normalized);
      if (dup) continue;

      const totalBeforeThisRow = n0 + created;
      const isProfileMatch = profileWallet != null && profileWallet === normalized;
      const isPrimary = totalBeforeThisRow === 0 || isProfileMatch;
      await insertUserWallet({
        user_id: user.id,
        wallet_address: normalized,
        label: labelForLinkedSolanaWallet(w, isPrimary),
        is_primary: isPrimary,
        slot: n0 + created,
        is_archived: false,
        is_active: true,
        is_imported: false,
      });
      created += 1;
    }

    for (const { address, chain } of embedded.filter((e) => e.chain === 'ethereum')) {
      const normalized = normalizeWalletAddressForStorage(address);
      if (!normalized) continue;
      const dup = await getUserWalletByAddress(user.id, normalized);
      if (dup) continue;

      const totalBeforeThisRow = n0 + created;
      const isPrimary = totalBeforeThisRow === 0;
      await insertUserWallet({
        user_id: user.id,
        wallet_address: normalized,
        label: 'Pointer EVM',
        is_primary: isPrimary,
        slot: n0 + created,
        is_archived: false,
        is_active: true,
        is_imported: false,
      });
      created += 1;
    }

    if (profileWallet) {
      const row = await getUserWalletByAddress(user.id, profileWallet);
      if (row && !row.is_primary) {
        await setPrimaryUserWallet(user.id, row.id);
      }
    }

    return NextResponse.json({ ok: true, created });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sync_failed';
    return NextResponse.json({ error: 'sync_failed', message }, { status: 500 });
  }
}
