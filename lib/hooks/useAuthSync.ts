'use client';

import { useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const SYNC_ENDPOINT = '/api/auth/sync';

interface SyncedUser {
  id: string;
  privyId: string;
  walletAddress: string | null;
  email: string | null;
  username: string | null;
  tierId: string;
  createdAt: string;
}

/**
 * Best-effort idempotent user sync — matches `pointer` repo.
 * Calls `POST /api/auth/sync` with the Privy bearer token after login.
 */
export function useAuthSync() {
  const { authenticated, ready, getAccessToken, user } = usePrivy();
  const { wallets } = useWallets();
  const queryClient = useQueryClient();

  const lastSyncedKeyRef = useRef<string | null>(null);
  const privyWalletSyncRef = useRef(false);

  useEffect(() => {
    if (!authenticated) privyWalletSyncRef.current = false;
  }, [authenticated]);

  const wallet = wallets[0]?.address ?? null;
  const email = user?.email?.address ?? null;
  const username = user?.twitter?.username ?? user?.google?.name ?? null;

  useEffect(() => {
    if (!ready || !authenticated) return;

    const key = [user?.id, wallet, email, username].join('|');
    if (lastSyncedKeyRef.current === key) return;

    let cancelled = false;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;

        const res = await fetch(SYNC_ENDPOINT, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            walletAddress: wallet,
            email,
            username,
          }),
        });

        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(payload.message ?? `sync failed (${res.status})`);
        }

        const json = (await res.json()) as { user: SyncedUser };
        if (!cancelled) {
          lastSyncedKeyRef.current = key;
          void queryClient.invalidateQueries();
          console.debug('[auth] synced user', json.user.id);

          if (!privyWalletSyncRef.current) {
            privyWalletSyncRef.current = true;
            void fetch('/api/wallets/sync-privy', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
            }).then(() => {
              void queryClient.invalidateQueries({ queryKey: ['wallets-my'] });
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'unknown error';
          toast.error('Account sync failed', { description: message });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    authenticated,
    getAccessToken,
    user?.id,
    wallet,
    email,
    username,
    queryClient,
  ]);
}
