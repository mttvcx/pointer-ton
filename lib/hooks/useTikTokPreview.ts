import { useQuery, type UseQueryResult } from '@tanstack/react-query';

export type TikTokPreview = {
  type: 'tiktok';
  url: string;
  fallback: boolean;
  authorName: string | null;
  authorUrl: string | null;
  handle: string | null;
  title: string | null;
  thumbnailUrl: string | null;
};

/** TikTok preview (author + thumbnail) via the keyless oEmbed route. Mirrors useTwitterTweetPreview. */
export function useTikTokPreview(url: string | null | undefined, options?: { enabled?: boolean }): UseQueryResult<TikTokPreview, Error> {
  return useQuery<TikTokPreview, Error>({
    queryKey: ['tiktok-preview', url],
    enabled: Boolean(url) && (options?.enabled ?? true),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const res = await fetch(`/api/tiktok-preview?url=${encodeURIComponent(url!)}`);
      if (!res.ok) throw new Error('tiktok preview failed');
      return (await res.json()) as TikTokPreview;
    },
  });
}
