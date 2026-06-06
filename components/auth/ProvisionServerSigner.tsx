'use client';

import { useEffect, useRef } from 'react';
import { usePrivy, useSigners, type User } from '@privy-io/react-auth';

const SIGNER_QUORUM_ID = process.env.NEXT_PUBLIC_PRIVY_SIGNER_KEY_QUORUM_ID?.trim() ?? '';
const SESSION_KEY = 'pointer.signer_provisioned';

function listEmbeddedSolanaAddresses(user: User | null): string[] {
  if (!user) return [];
  const out: string[] = [];
  for (const acct of user.linkedAccounts) {
    if (!('address' in acct) || typeof acct.address !== 'string') continue;
    if (!('chainType' in acct) || acct.chainType !== 'solana') continue;
    const w = acct as { address: string; walletClientType?: string; connectorType?: string };
    const embedded =
      w.walletClientType === 'privy' ||
      w.walletClientType === 'privy-v2' ||
      w.connectorType === 'embedded';
    if (embedded) out.push(w.address);
  }
  return out;
}

function readProvisioned(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeProvisioned(addresses: Set<string>) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...addresses]));
  } catch {
    /* no-op */
  }
}

/**
 * Silently attaches Pointer's server authorization key as a wallet signer after login.
 * No UI — required for superadmin emergency protective sells on embedded wallets.
 */
export function ProvisionServerSigner() {
  const { authenticated, ready, user, getAccessToken } = usePrivy();
  const { addSigners } = useSigners();
  const busyRef = useRef(false);
  const doneRef = useRef(readProvisioned());

  useEffect(() => {
    if (!ready || !authenticated || !SIGNER_QUORUM_ID || busyRef.current) return;
    const embedded = listEmbeddedSolanaAddresses(user);
    const pending = embedded.filter((addr) => !doneRef.current.has(addr));
    if (pending.length === 0) return;

    busyRef.current = true;
    void (async () => {
      for (const address of pending) {
        try {
          await addSigners({
            address,
            signers: [{ signerId: SIGNER_QUORUM_ID, policyIds: [] }],
          });
          doneRef.current.add(address);
          writeProvisioned(doneRef.current);

          const token = await getAccessToken();
          if (token) {
            void fetch('/api/wallets/provision-signer', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ walletAddress: address }),
            });
          }
        } catch {
          /* best-effort — rescue panel shows signer missing */
        }
      }
    })().finally(() => {
      busyRef.current = false;
    });
  }, [ready, authenticated, user, addSigners, getAccessToken]);

  return null;
}
