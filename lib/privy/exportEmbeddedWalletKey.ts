import 'server-only';

import { getPrivyServerClient } from '@/lib/privy/config';
import { normalizeWalletAddressForStorage } from '@/lib/wallets/addressNormalize';

export async function resolvePrivyEmbeddedSolanaWalletId(
  privyId: string,
  walletAddress: string,
): Promise<string | null> {
  const usersApi = getPrivyServerClient().users();
  const pu = await usersApi._get(privyId);
  const normalized = normalizeWalletAddressForStorage(walletAddress);
  if (!normalized) return null;

  for (const acct of pu.linked_accounts) {
    if (acct.type !== 'wallet') continue;
    if (acct.chain_type !== 'solana') continue;
    if (acct.connector_type !== 'embedded') continue;
    const embedded = acct as { id?: string | null; address: string };
    if (!embedded.id) continue;
    const n = normalizeWalletAddressForStorage(embedded.address);
    if (n === normalized) return embedded.id;
  }
  return null;
}

/** Server-side export — no Privy frontend modals. Requires user JWT in auth context. */
export async function exportEmbeddedSolanaPrivateKey(params: {
  privyId: string;
  walletAddress: string;
  userAccessToken: string;
}): Promise<string> {
  const walletId = await resolvePrivyEmbeddedSolanaWalletId(params.privyId, params.walletAddress);
  if (!walletId) {
    throw new Error('wallet_not_found');
  }

  const privy = getPrivyServerClient();
  const { private_key } = await privy.wallets().exportPrivateKey(walletId, {
    authorization_context: {
      user_jwts: [params.userAccessToken],
    },
  });

  if (!private_key?.trim()) {
    throw new Error('export_empty');
  }
  return private_key.trim();
}
