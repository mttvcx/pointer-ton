import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@privy-io/node';
import { getUserByPrivyId } from '@/lib/db/users';
import {
  countUserWallets,
  getUserWalletByAddress,
  insertUserWallet,
} from '@/lib/db/userWallets';
import { getPrivyServerClient, verifyPrivyAccessToken } from '@/lib/privy/config';
import { normalizeWalletAddressForStorage } from '@/lib/wallets/addressNormalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function embeddedWalletAddresses(user: User): Array<{ address: string; chain: 'solana' | 'ethereum' }> {
  const out: Array<{ address: string; chain: 'solana' | 'ethereum' }> = [];
  for (const acct of user.linked_accounts) {
    if (acct.type !== 'wallet') continue;
    if (!('address' in acct) || typeof acct.address !== 'string') continue;
    if (!('chain_type' in acct)) continue;
    if (acct.chain_type === 'solana' || acct.chain_type === 'ethereum') {
      const wa = acct as { address: string; chain_type: 'solana' | 'ethereum'; connector_type?: string };
      if (wa.connector_type === 'embedded') {
        out.push({ address: wa.address, chain: wa.chain_type });
      }
    }
  }
  return out;
}

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
    let embedded = embeddedWalletAddresses(pu);

    if (embedded.length === 0) {
      try {
        await usersApi.pregenerateWallets(verified.privyId, {
          wallets: [{ chain_type: 'solana' }, { chain_type: 'ethereum' }],
        });
        pu = await usersApi._get(verified.privyId);
        embedded = embeddedWalletAddresses(pu);
      } catch {
        /* Privy may already have provisioned wallets via dashboard / login */
      }
    }
    let created = 0;

    const n0 = await countUserWallets(user.id);

    for (const { address, chain } of embedded) {
      const normalized = normalizeWalletAddressForStorage(address);
      if (!normalized) continue;
      const dup = await getUserWalletByAddress(user.id, normalized);
      if (dup) continue;

      const label = chain === 'solana' ? 'Privy Solana' : 'Privy EVM';
      const slot = n0 + created;
      const totalBeforeThisRow = n0 + created;
      await insertUserWallet({
        user_id: user.id,
        wallet_address: normalized,
        label,
        is_primary: totalBeforeThisRow === 0,
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
