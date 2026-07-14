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
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">My Videos</h1>
        <p className="mt-0.5 text-[13px] text-fg-muted">All submitted clips and review status.</p>
      </div>
      <div className="creator-glass overflow-hidden rounded-2xl">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-white/[0.07] text-[10px] uppercase tracking-[0.12em] text-fg-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Platform</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Views</th>
              <th className="px-4 py-3 text-right font-medium">Earned</th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((v) => {
              const status = v.review_status;
              const tone =
                status === 'approved' || status === 'verified'
                  ? 'bg-signal-bull/15 text-signal-bull ring-signal-bull/25'
                  : status === 'rejected'
                    ? 'bg-signal-bear/15 text-signal-bear ring-signal-bear/25'
                    : 'bg-signal-warn/15 text-signal-warn ring-signal-warn/25';
              return (
                <tr key={v.id} className="border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium capitalize">{v.platform}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${tone}`}>
                      {status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{v.view_count.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-signal-bull">
                    ${(v.earnings_verified_cents / 100).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!q.data?.length ? (
          <p className="p-8 text-center text-[13px] text-fg-muted">No submissions yet.</p>
        ) : null}
      </div>
    </div>
  );
}
