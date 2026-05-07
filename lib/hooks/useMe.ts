'use client';

import { useQuery } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';

export const ME_QUERY_KEY = ['me'] as const;

export type MeUser = {
  id: string;
  privyId: string;
  walletAddress: string | null;
  email: string | null;
  username: string | null;
  tierId: string;
  createdAt: string;
  onboardingCompletedAt: string | null;
  onboardingStep: number;
};

export function useMeQuery() {
  const { authenticated, ready, getAccessToken } = usePointerAuth();

  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async (): Promise<MeUser> => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `me_${res.status}`);
      }
      const json = (await res.json()) as { user: MeUser };
      return json.user;
    },
    enabled: Boolean(ready && authenticated),
    staleTime: 30_000,
  });
}
