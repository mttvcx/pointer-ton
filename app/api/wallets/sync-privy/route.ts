import { NextResponse, type NextRequest } from 'next/server';
import { getUserByPrivyId } from '@/lib/db/users';
import {
  countUserWallets,
  getUserWalletByAddress,
  insertUserWallet,
} from '@/lib/db/userWallets';
import { listPrivyEmbeddedWalletsFromUser } from '@/lib/privy/embeddedWallets';
import { getPrivyServerClient, verifyPrivyAccessToken } from '@/lib/privy/config';
import { normalizeWalletAddressForStorage } from '@/lib/wallets/addressNormalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Upserts `user_wallets` rows for Privy embedded Solana + Ethereum wallets so every chain has a deposit address.
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

    // Solana first so the SOL embedded wallet takes the primary slot off spawn
    // (Pointer is SOL-first) and gets the "Pointer Wallet" name.
    const ordered = [...embedded].sort((a, b) => {
      if (a.chain === b.chain) return 0;
      return a.chain === 'solana' ? -1 : 1;
    });

    for (const { address, chain } of ordered) {
      const normalized = normalizeWalletAddressForStorage(address);
      if (!normalized) continue;
      const dup = await getUserWalletByAddress(user.id, normalized);
      if (dup) continue;

      const totalBeforeThisRow = n0 + created;
      const isPrimary = totalBeforeThisRow === 0;
      // The user's main spawn wallet is the primary SOL embedded wallet.
      const label =
        chain === 'solana'
          ? isPrimary
            ? 'Pointer Wallet'
            : 'Pointer Solana'
          : 'Pointer EVM';
      const slot = n0 + created;
      await insertUserWallet({
        user_id: user.id,
        wallet_address: normalized,
        label,
        is_primary: isPrimary,
        slot,
        is_archived: false,
        is_active: true,
        is_imported: false,
      });
      created += 1;
    }

    return NextResponse.json({ ok: true, created });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sync_failed';
    return NextResponse.json({ error: 'sync_failed', message }, { status: 500 });
  }
}
