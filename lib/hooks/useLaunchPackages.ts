'use client';

import { useQuery } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import type { LaunchPackage, TweetLaunchInput } from '@/lib/launch/types';
import type { AppChainId } from '@/lib/chains/appChain';

export type LaunchPackageResult = {
  subject: string;
  tweet: TweetLaunchInput;
  package: LaunchPackage;
  cacheHit: boolean;
  fromCache: boolean;
};

export function useLaunchPackages(
  tweets: TweetLaunchInput[],
  enabled: boolean,
  chain: AppChainId = 'sol',
) {
  const { authenticated, getAccessToken } = usePointerAuth();
  const key = tweets
    .map((t) => `${t.id ?? ''}:${(t.text ?? '').slice(0, 40)}`)
    .join('|');

  return useQuery({
    // Chain in the key so switching SOL↔EVM re-suggests the right launchpads.
    queryKey: ['launch-packages', chain, key],
    enabled: enabled && authenticated && tweets.length > 0,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async (): Promise<LaunchPackageResult[]> => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/ai/launch-packages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tweets, chain }),
      });
      const json: unknown = await res.json();
      if (!res.ok) throw new Error('launch_packages_failed');
      const items = (json as { items?: { subject: string; package: LaunchPackage }[] }).items;
      if (!Array.isArray(items)) return [];
      return items.map((row, i) => ({
        subject: row.subject,
        tweet: tweets[i]!,
        package: row.package,
        cacheHit: false,
        fromCache: false,
      }));
    },
  });
}
