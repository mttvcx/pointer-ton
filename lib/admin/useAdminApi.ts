'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';

export type AdminMe = {
  userId: string;
  walletAddress: string | null;
  username: string | null;
  email: string | null;
  roles: { key: string; name: string }[];
  permissions: string[];
};

/** Authenticated fetch helper bound to the current Privy/TON session token. */
export function useAdminFetch() {
  const { getAccessToken } = usePointerAuth();
  return useCallback(
    async (input: string, init?: RequestInit) => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${token}`);
      if (init?.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      return fetch(input, { ...init, headers });
    },
    [getAccessToken],
  );
}

/** Current admin identity + effective permissions, or null when not an admin. */
export function useAdminMe() {
  const { authenticated, ready, getAccessToken } = usePointerAuth();
  const adminFetch = useAdminFetch();
  return useQuery({
    queryKey: ['admin-me'],
    queryFn: async (): Promise<AdminMe | null> => {
      const token = await getAccessToken();
      if (!token) return null;
      const res = await adminFetch('/api/admin/me');
      if (res.status === 403 || res.status === 401) return null;
      if (!res.ok) throw new Error(`admin_me_${res.status}`);
      const json = (await res.json()) as { admin: AdminMe };
      return json.admin;
    },
    enabled: Boolean(ready && authenticated),
    staleTime: 30_000,
    retry: false,
  });
}

export function adminCan(me: AdminMe | null | undefined, perm: string): boolean {
  if (!me) return false;
  return me.permissions.includes('*') || me.permissions.includes(perm);
}
