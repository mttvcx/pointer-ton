'use client';

import { useQuery } from '@tanstack/react-query';

export default function CreatorVideosPage() {
  const q = useQuery({
    queryKey: ['creator-videos'],
    queryFn: async () => {
      const res = await fetch('/api/creators/videos');
      const j = (await res.json()) as {
        videos: Array<{
          id: string;
          platform: string;
          post_url: string;
          view_count: number;
          review_status: string;
          earnings_verified_cents: number;
          created_at: string;
        }>;
      };
      return j.videos;
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold">My Videos</h1>
        <p className="text-[13px] text-fg-muted">All submitted clips and review status.</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-border-subtle bg-bg-raised text-[10px] uppercase tracking-wide text-fg-muted">
            <tr>
              <th className="px-3 py-2">Platform</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Views</th>
              <th className="px-3 py-2">Earned</th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((v) => (
              <tr key={v.id} className="border-b border-border-subtle/60">
                <td className="px-3 py-2 capitalize">{v.platform}</td>
                <td className="px-3 py-2">{v.review_status.replace(/_/g, ' ')}</td>
                <td className="px-3 py-2 tabular-nums">{v.view_count.toLocaleString()}</td>
                <td className="px-3 py-2 tabular-nums">${(v.earnings_verified_cents / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!q.data?.length ? (
          <p className="p-6 text-center text-[13px] text-fg-muted">No submissions yet.</p>
        ) : null}
      </div>
    </div>
  );
}
