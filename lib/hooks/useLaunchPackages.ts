'use client';

import { useQuery } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import type { LaunchPackage, TweetLaunchInput } from '@/lib/launch/types';

export type LaunchPackageResult = {
  subject: string;
  tweet: TweetLaunchInput;
  package: LaunchPackage;
  cacheHit: boolean;
  fromCache: boolean;
};

export function useLaunchPackages(tweets: TweetLaunchInput[], enabled: boolean) {
  const { authenticated, getAccessToken } = usePointerAuth();
  const key = tweets.map((t) => `${t.id ?? ''}:${t.text.slice(0, 40)}`).join('|');

  return useQuery({
    queryKey: ['launch-packages', key],
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
        body: JSON.stringify({ tweets }),
      });
      const json: unknown = await res.json();
      if (!res.ok) throw new Error('launch_packages_failed');
      const items = (json as { items: { subject: string; package: LaunchPackage }[] }).items;
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
