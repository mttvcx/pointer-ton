'use client';

import { useMemo } from 'react';
import { usePrivy, type User } from '@privy-io/react-auth';

/**
 * Embedded (Pointer) Solana wallet addresses from the Privy user. Embedded
 * wallets are marked walletClientType privy/privy-v2 or connectorType embedded
 * (same detection as ProvisionServerSigner). External wallets (Phantom etc.) are
 * absent, so callers keep them on the wallet's own signAndSend broadcast.
 */
function listEmbeddedSolanaAddresses(user: User | null): string[] {
  if (!user) return [];
  const out: string[] = [];
  for (const acct of user.linkedAccounts) {
    if (!('address' in acct) || typeof acct.address !== 'string') continue;
    if (!('chainType' in acct) || acct.chainType !== 'solana') continue;
    const w = acct as { address: string; walletClientType?: string; connectorType?: string };
    if (
      w.walletClientType === 'privy' ||
      w.walletClientType === 'privy-v2' ||
      w.connectorType === 'embedded'
    ) {
      out.push(w.address);
    }
  }
  return out;
}

/** Set of the signed-in user's embedded Pointer Solana wallet addresses. */
export function useEmbeddedSolanaAddresses(): Set<string> {
  const { user } = usePrivy();
  return useMemo(() => new Set(listEmbeddedSolanaAddresses(user)), [user]);
}
