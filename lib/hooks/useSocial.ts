'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';

export type FriendView = {
  userId: string;
  username: string | null;
  walletAddress: string | null;
  twitterHandle: string | null;
  since: string;
};
export type FriendRequestView = {
  requestId: string;
  fromUserId: string;
  username: string | null;
  walletAddress: string | null;
  twitterHandle: string | null;
  createdAt: string;
};
export type FollowEdge = {
  targetType: 'user' | 'wallet' | 'twitter';
  targetRef: string;
  createdAt: string;
  username?: string | null;
  walletAddress?: string | null;
  twitterHandle?: string | null;
};

function useAuthedFetch() {
  const { getAccessToken } = usePointerAuth();
  return useCallback(
    async (url: string, init?: RequestInit) => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(url, {
        ...init,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
      });
      if (!res.ok) throw new Error(`request_failed_${res.status}`);
      return res.json();
    },
    [getAccessToken],
  );
}

export function useFriends() {
  const authed = useAuthedFetch();
  const { authenticated } = usePointerAuth();
  return useQuery({
    queryKey: ['social-friends'],
    enabled: authenticated,
    queryFn: async (): Promise<{ friends: FriendView[] }> => authed('/api/social/friends'),
    staleTime: 30_000,
  });
}

export function useFriendRequests() {
  const authed = useAuthedFetch();
  const { authenticated } = usePointerAuth();
  return useQuery({
    queryKey: ['social-friend-requests'],
    enabled: authenticated,
    queryFn: async (): Promise<{ requests: FriendRequestView[] }> => authed('/api/social/friend-requests'),
    refetchInterval: 30_000,
  });
}

export function useFollowing() {
  const authed = useAuthedFetch();
  const { authenticated } = usePointerAuth();
  return useQuery({
    queryKey: ['social-following'],
    enabled: authenticated,
    queryFn: async (): Promise<{ following: FollowEdge[]; counts: { following: number; followers: number } }> =>
      authed('/api/social/following'),
    staleTime: 30_000,
  });
}

export function useSocialActions() {
  const authed = useAuthedFetch();
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['social-friends'] });
    void qc.invalidateQueries({ queryKey: ['social-friend-requests'] });
    void qc.invalidateQueries({ queryKey: ['social-following'] });
  };

  const respond = useMutation({
    mutationFn: (v: { requestId: string; accept: boolean }) =>
      authed('/api/social/friend-respond', { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: invalidate,
  });
  const request = useMutation({
    mutationFn: (v: { targetUserId: string }) =>
      authed('/api/social/friend-request', { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: invalidate,
  });
  const follow = useMutation({
    mutationFn: (v: { targetType: 'user' | 'wallet' | 'twitter'; targetRef: string }) =>
      authed('/api/social/follow', { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: invalidate,
  });
  const unfollow = useMutation({
    mutationFn: (v: { targetType: 'user' | 'wallet' | 'twitter'; targetRef: string }) =>
      authed('/api/social/unfollow', { method: 'POST', body: JSON.stringify(v) }),
    onSuccess: invalidate,
  });

  return { respond, request, follow, unfollow };
}
