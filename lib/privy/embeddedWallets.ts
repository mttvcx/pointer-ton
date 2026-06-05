import 'server-only';

import type { User } from '@privy-io/node';
import { getPrivyServerClient } from '@/lib/privy/config';
import { normalizeWalletAddressForStorage } from '@/lib/wallets/addressNormalize';

export type PrivyEmbeddedWallet = { address: string; chain: 'solana' | 'ethereum' };

export function listPrivyEmbeddedWalletsFromUser(user: User): PrivyEmbeddedWallet[] {
  const out: PrivyEmbeddedWallet[] = [];
  for (const acct of user.linked_accounts) {
    if (acct.type !== 'wallet') continue;
    if (!('address' in acct) || typeof acct.address !== 'string') continue;
    if (!('chain_type' in acct)) continue;
    if (acct.chain_type === 'solana' || acct.chain_type === 'ethereum') {
      const wa = acct as {
        address: string;
        chain_type: 'solana' | 'ethereum';
        connector_type?: string;
      };
      if (wa.connector_type === 'embedded') {
        out.push({ address: wa.address, chain: wa.chain_type });
      }
    }
  }
  return out;
}

export async function fetchPrivyEmbeddedWallets(privyId: string): Promise<PrivyEmbeddedWallet[]> {
  const usersApi = getPrivyServerClient().users();
  const pu = await usersApi._get(privyId);
  return listPrivyEmbeddedWalletsFromUser(pu);
}

/** True when address is the session wallet or any Privy embedded wallet on the user. */
export async function privyUserOwnsEmbeddedAddress(
  privyId: string,
  walletAddress: string,
  sessionWalletAddress?: string | null,
): Promise<boolean> {
  const normalized = normalizeWalletAddressForStorage(walletAddress);
  if (!normalized) return false;

  const session = sessionWalletAddress
    ? normalizeWalletAddressForStorage(sessionWalletAddress)
    : null;
  if (session && session === normalized) return true;

  try {
    const embedded = await fetchPrivyEmbeddedWallets(privyId);
    return embedded.some((w) => {
      const n = normalizeWalletAddressForStorage(w.address);
      return Boolean(n && n === normalized);
    });
  } catch {
    return false;
  }
}
