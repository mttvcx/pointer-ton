'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type AdminVideo = {
  id: string;
  post_url: string;
  review_status: string;
  creator_id: string;
  view_count: number;
  platform: string;
};

type AdminAppeal = {
  id: string;
  target_type: string;
  message: string;
  evidence_url: string | null;
  created_at: string;
  creators?: { discord_username?: string; discord_global_name?: string; discord_id?: string };
};

export default function CreatorAdminPage() {
  const qc = useQueryClient();
  const [viewOverrides, setViewOverrides] = useState<Record<string, string>>({});
  const [blacklistId, setBlacklistId] = useState('');
  const [blacklistReason, setBlacklistReason] = useState('');

  const q = useQuery({
    queryKey: ['creator-admin-queue'],
    queryFn: async () => {
      const res = await fetch('/api/creators/admin');
      if (res.status === 403) throw new Error('forbidden');
      return res.json() as Promise<{
        verifications: Array<{ id: string; account_id: string; created_at: string }>;
        videos: AdminVideo[];
        appeals: AdminAppeal[];
      }>;
    },
  });

  async function reviewVerification(id: string, approved: boolean, tier?: 'basic' | 'elite') {
    const tier1Pct = tier === 'elite' ? 45 : 25;
    const res = await fetch('/api/creators/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'review_verification',
        submissionId: id,
        approved,
        tier: approved ? tier : undefined,
        tier1Pct: approved ? tier1Pct : undefined,
        note: approved ? undefined : 'Does not meet Tier-1 minimum',
      }),
    });
    if (!res.ok) {
      toast.error('Review failed');
      return;
    }
    toast.success(approved ? 'Approved' : 'Rejected');
    void qc.invalidateQueries({ queryKey: ['creator-admin-queue'] });
  }

  async function refreshViews(video: AdminVideo) {
    const res = await fetch(`/api/creators/videos/preview-views?url=${encodeURIComponent(video.post_url)}`);
    const j = (await res.json()) as { views?: number | null; source?: string };
    if (j.views != null) {
      setViewOverrides((prev) => ({ ...prev, [video.id]: String(j.views) }));
      toast.success(`Fetched ${j.views.toLocaleString()} views (${j.source ?? 'unknown'})`);
    } else {
      toast.error('Could not fetch views — enter manually');
    }
  }

  async function reviewVideo(id: string, status: string) {
    const raw = viewOverrides[id];
    const viewCount = raw ? Number.parseInt(raw, 10) : undefined;
    const res = await fetch('/api/creators/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'review_video',
        videoId: id,
        status,
        viewCount: Number.isFinite(viewCount) ? viewCount : undefined,
      }),
    });
    if (!res.ok) {
      toast.error('Review failed');
      return;
    }
    toast.success('Video updated');
    void qc.invalidateQueries({ queryKey: ['creator-admin-queue'] });
  }

  async function reviewAppeal(id: string, approved: boolean) {
    const res = await fetch('/api/creators/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'review_appeal', appealId: id, approved }),
    });
    if (!res.ok) {
      toast.error('Appeal review failed');
      return;
    }
    toast.success(approved ? 'Appeal approved' : 'Appeal denied');
    void qc.invalidateQueries({ queryKey: ['creator-admin-queue'] });
  }

  async function blacklist(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/creators/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'blacklist', discordId: blacklistId, reason: blacklistReason }),
    });
    if (!res.ok) {
      toast.error('Blacklist failed');
      return;
    }
    toast.success('User blacklisted');
    setBlacklistId('');
    setBlacklistReason('');
  }

  if (q.error) {
    return <p className="text-[13px] text-fg-muted">Admin access required.</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Admin review</h1>
        <p className="mt-0.5 text-[13px] text-fg-muted">Verifications, clip fraud flags, botting, stolen content, appeals.</p>
      </div>

      <section className="creator-glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold tracking-tight">Pending verifications</h2>
        <ul className="mt-3 space-y-2">
          {(q.data?.verifications ?? []).length === 0 ? (
            <li className="text-[12px] text-fg-muted">None pending</li>
          ) : null}
          {(q.data?.verifications ?? []).map((v) => (
            <li key={v.id} className="creator-glass-quiet flex flex-wrap items-center gap-2 rounded-xl p-3 text-[12px]">
              <span className="font-mono text-fg-muted">{v.id.slice(0, 8)}…</span>
              <button type="button" onClick={() => void reviewVerification(v.id, true, 'basic')} className="rounded bg-signal-bull/20 px-2 py-1">
                Approve BASIC
              </button>
              <button type="button" onClick={() => void reviewVerification(v.id, true, 'elite')} className="rounded bg-accent-primary/20 px-2 py-1">
                Approve ELITE
              </button>
              <button type="button" onClick={() => void reviewVerification(v.id, false)} className="rounded bg-signal-bear/20 px-2 py-1">
                Reject
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="creator-glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold tracking-tight">Pending clips</h2>
        <ul className="mt-3 space-y-3">
          {(q.data?.videos ?? []).length === 0 ? (
            <li className="text-[12px] text-fg-muted">None pending</li>
          ) : null}
          {(q.data?.videos ?? []).map((v) => (
            <li key={v.id} className="creator-glass-quiet rounded-xl p-3 text-[12px]">
              <a href={v.post_url} target="_blank" rel="noreferrer" className="text-accent-primary hover:underline">
                {v.post_url}
              </a>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-fg-muted capitalize">{v.platform}</span>
                <span className="font-mono tabular-nums text-fg-secondary">
                  stored: {v.view_count.toLocaleString()} views
                </span>
                <input
                  type="number"
                  min={0}
                  placeholder="View override"
                  value={viewOverrides[v.id] ?? ''}
                  onChange={(e) => setViewOverrides((prev) => ({ ...prev, [v.id]: e.target.value }))}
                  className="creator-field w-28 rounded-lg px-2 py-0.5 font-mono text-[11px]"
                />
                <button
                  type="button"
                  onClick={() => void refreshViews(v)}
                  className="rounded border border-border-subtle px-2 py-0.5 text-[10px] hover:bg-bg-hover"
                >
                  Fetch views
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {(['approved', 'rejected_stolen', 'rejected_botting', 'rejected_audience', 'reduced_pay', 'rejected'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void reviewVideo(v.id, s)}
                    className="rounded border border-border-subtle px-2 py-0.5 text-[10px] hover:bg-bg-hover"
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="creator-glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold tracking-tight">Pending appeals</h2>
        <ul className="mt-3 space-y-2">
          {(q.data?.appeals ?? []).length === 0 ? (
            <li className="text-[12px] text-fg-muted">None pending</li>
          ) : null}
          {(q.data?.appeals ?? []).map((a) => (
            <li key={a.id} className="creator-glass-quiet rounded-xl p-3 text-[12px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {(a.creators?.discord_global_name || a.creators?.discord_username || 'creator') as string}
                </span>
                <span className="text-fg-muted">· {a.target_type}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-fg-secondary">{a.message}</p>
              {a.evidence_url ? (
                <a href={a.evidence_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-accent-primary hover:underline">
                  Evidence link
                </a>
              ) : null}
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => void reviewAppeal(a.id, true)} className="rounded bg-signal-bull/20 px-2 py-1">
                  Approve
                </button>
                <button type="button" onClick={() => void reviewAppeal(a.id, false)} className="rounded bg-signal-bear/20 px-2 py-1">
                  Deny
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="creator-glass rounded-2xl border-signal-bear/20 p-5">
        <h2 className="text-sm font-semibold tracking-tight text-signal-bear">Blacklist Discord ID</h2>
        <form onSubmit={(e) => void blacklist(e)} className="mt-3 flex flex-wrap gap-2">
          <input
            value={blacklistId}
            onChange={(e) => setBlacklistId(e.target.value)}
            placeholder="Discord user ID"
            className="creator-field min-w-[12rem] flex-1 rounded-lg px-3 py-1.5 text-[12px] text-fg-primary placeholder:text-fg-muted"
            required
          />
          <input
            value={blacklistReason}
            onChange={(e) => setBlacklistReason(e.target.value)}
            placeholder="Reason"
            className="creator-field min-w-[12rem] flex-1 rounded-lg px-3 py-1.5 text-[12px] text-fg-primary placeholder:text-fg-muted"
            required
          />
          <button type="submit" className="rounded-lg bg-signal-bear/20 px-4 py-1.5 text-[12px] font-semibold text-signal-bear ring-1 ring-inset ring-signal-bear/30 transition-colors hover:bg-signal-bear/30">
            Blacklist
          </button>
        </form>
      </section>
    </div>
  );
}
