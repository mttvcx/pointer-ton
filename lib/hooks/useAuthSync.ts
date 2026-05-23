'use client';

import { useEffect, useRef } from 'react';
import { getIdentityToken, usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthSyncStore } from '@/store/authSync';

const SYNC_ENDPOINT = '/api/auth/sync';
const SYNCED_USER_KEY = 'pointer_auth_synced_user';

interface SyncedUser {
  id: string;
  privyId: string;
  walletAddress: string | null;
  email: string | null;
  username: string | null;
  tierId: string;
  createdAt: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readSyncedUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(SYNCED_USER_KEY);
  } catch {
    return null;
  }
}

function writeSyncedUserId(userId: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (userId) sessionStorage.setItem(SYNCED_USER_KEY, userId);
    else sessionStorage.removeItem(SYNCED_USER_KEY);
  } catch {
    /* no-op */
  }
}

function isRetryableSyncError(status: number, message: string): boolean {
  if (status === 401 || status === 403 || status === 429) return true;
  if (status >= 500) return false;
  return /token|auth|verify|expired|too many|rate.?limit/i.test(message);
}

function retryDelayMs(status: number, message: string, attempt: number): number {
  const rateLimited =
    status === 429 || /too many|rate.?limit/i.test(message);
  if (rateLimited) {
    return [2_000, 5_000, 12_000, 25_000][attempt] ?? 25_000;
  }
  return [350, 900, 1800][attempt] ?? 1800;
}

async function postPrivySyncOnce(
  token: string,
  body: { walletAddress: string | null; email: string | null; username: string | null },
): Promise<{ ok: true; user: SyncedUser } | { ok: false; status: number; message: string }> {
  const res = await fetch(SYNC_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    const json = (await res.json()) as { user: SyncedUser };
    return { ok: true, user: json.user };
  }

  const payload = (await res.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
  };
  const message = payload.message ?? payload.error ?? `sync failed (${res.status})`;
  return { ok: false, status: res.status, message };
}

async function postPrivySync(
  getAccessToken: () => Promise<string | null>,
  body: { walletAddress: string | null; email: string | null; username: string | null },
): Promise<SyncedUser> {
  const maxAttempts = 3;
  let lastError = 'sync failed';
  let lastStatus = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(retryDelayMs(lastStatus, lastError, attempt - 1));

    const accessToken = await getAccessToken();
    const identityToken = accessToken ? null : await getIdentityToken();
    const token = accessToken ?? identityToken;
    if (!token) {
      lastError = 'no_token';
      continue;
    }

    let result = await postPrivySyncOnce(token, body);
    if (!result.ok && result.status === 401 && accessToken) {
      const fallback = await getIdentityToken();
      if (fallback && fallback !== accessToken) {
        result = await postPrivySyncOnce(fallback, body);
      }
    }

    if (result.ok) return result.user;

    lastError = result.message;
    lastStatus = result.status;
    if (!isRetryableSyncError(result.status, lastError) || attempt === maxAttempts - 1) {
      throw new Error(lastError);
    }
  }

  throw new Error(lastError);
}

/**
 * Best-effort idempotent user sync — matches `pointer` repo.
 * Calls `POST /api/auth/sync` with the Privy bearer token after login.
 */
export function useAuthSync() {
  const { authenticated, ready, getAccessToken, user } = usePrivy();
  const { wallets } = useWallets();
  const queryClient = useQueryClient();
  const setBackendReady = useAuthSyncStore((s) => s.setBackendReady);
  const setSyncing = useAuthSyncStore((s) => s.setSyncing);
  const setLastError = useAuthSyncStore((s) => s.setLastError);
  const reset = useAuthSyncStore((s) => s.reset);

  const lastSyncedUserRef = useRef<string | null>(null);
  const privyWalletSyncRef = useRef(false);
  const syncRunRef = useRef(0);
  const syncInFlightRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authenticated) {
      privyWalletSyncRef.current = false;
      lastSyncedUserRef.current = null;
      writeSyncedUserId(null);
      reset();
    }
  }, [authenticated, reset]);

  useEffect(() => {
    if (ready && !authenticated) {
      setBackendReady(true);
      setSyncing(false);
      setLastError(null);
    }
  }, [ready, authenticated, setBackendReady, setSyncing, setLastError]);

  const wallet = wallets[0]?.address ?? null;
  const email = user?.email?.address ?? null;
  const username = user?.twitter?.username ?? user?.google?.name ?? null;
  const userId = user?.id ?? null;
  const profileRef = useRef({ wallet, email, username });
  profileRef.current = { wallet, email, username };

  useEffect(() => {
    if (!ready || !authenticated || !userId) return;

    if (readSyncedUserId() === userId) {
      setBackendReady(true);
      lastSyncedUserRef.current = userId;
    }

    if (lastSyncedUserRef.current === userId || syncInFlightRef.current === userId) return;

    const runId = ++syncRunRef.current;
    let cancelled = false;
    syncInFlightRef.current = userId;
    setSyncing(true);
    setLastError(null);

    /** Brief delay so Privy embedded wallet address is usually available before verify. */
    const kickoff = window.setTimeout(() => {
      void (async () => {
        try {
          const profile = profileRef.current;
          const synced = await postPrivySync(getAccessToken, {
            walletAddress: profile.wallet,
            email: profile.email,
            username: profile.username,
          });

          if (cancelled || syncRunRef.current !== runId) return;

          lastSyncedUserRef.current = userId;
          writeSyncedUserId(userId);
          setBackendReady(true);
          setLastError(null);
          void queryClient.invalidateQueries({ queryKey: ['wallets-my'] });
          void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
          void queryClient.invalidateQueries({ queryKey: ['me'] });
          console.debug('[auth] synced user', synced.id);

          if (!privyWalletSyncRef.current) {
            privyWalletSyncRef.current = true;
            const token = await getAccessToken();
            if (token) {
              void fetch('/api/wallets/sync-privy', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
              }).then(() => {
                void queryClient.invalidateQueries({ queryKey: ['wallets-my'] });
              });
            }
          }
        } catch (err) {
          if (cancelled || syncRunRef.current !== runId) return;
          const message = err instanceof Error ? err.message : 'unknown error';
          setLastError(message);
          if (readSyncedUserId() !== userId) {
            setBackendReady(false);
            toast.error('Account sync failed', { description: message });
          }
        } finally {
          if (syncInFlightRef.current === userId) syncInFlightRef.current = null;
          if (!cancelled && syncRunRef.current === runId) setSyncing(false);
        }
      })();
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(kickoff);
    };
    // One Privy verify per user per session — not on every wallet/email change.
  }, [
    ready,
    authenticated,
    getAccessToken,
    userId,
    queryClient,
    setBackendReady,
    setSyncing,
    setLastError,
  ]);
}
