'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function CreatorSubmitPage() {
  const qc = useQueryClient();
  const accountsQ = useQuery({
    queryKey: ['creator-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/creators/accounts');
      const j = (await res.json()) as { accounts: Array<{ id: string; platform: string; handle: string; verification_status: string }> };
      return j.accounts.filter((a) => a.verification_status === 'verified');
    },
  });

  const [accountId, setAccountId] = useState('');
  const [postUrl, setPostUrl] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/creators/videos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accountId, postUrl }),
      });
      const j = (await res.json()) as { error?: string; message?: string; video?: { view_count: number } };
      if (!res.ok) {
        toast.error(j.message ?? j.error ?? 'Submit failed');
        return;
      }
      const views = j.video?.view_count;
      toast.success(
        views != null && views > 0
          ? `Clip submitted — ${views.toLocaleString()} views detected`
          : 'Clip submitted for review',
      );
      setPostUrl('');
      void qc.invalidateQueries({ queryKey: ['creator-me'] });
    } finally {
      setBusy(false);
    }
  }

  const accounts = accountsQ.data ?? [];

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Submit Video</h1>
        <p className="text-[13px] text-fg-muted">Paste the public URL after posting your Pointer clip.</p>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-bg-raised p-4 text-[13px] text-fg-secondary">
          <p>Verify a TikTok, Instagram, or X account before submitting clips.</p>
          <Link
            href="/portal/settings"
            className="mt-3 inline-flex rounded-md bg-accent-primary px-4 py-2 text-[12px] font-semibold text-fg-inverse"
          >
            Verify account
          </Link>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="space-y-3 rounded-lg border border-border-subtle bg-bg-raised p-4">
          <label className="block text-[12px] font-medium text-fg-muted">
            Account
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 w-full rounded-md border border-border-subtle bg-bg-sunken px-3 py-2 text-[13px]"
              required
            >
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.platform} · @{a.handle}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-medium text-fg-muted">
            Post URL
            <input
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              placeholder="https://…"
              className="mt-1 w-full rounded-md border border-border-subtle bg-bg-sunken px-3 py-2 text-[13px]"
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-accent-primary py-2 text-[13px] font-semibold text-fg-inverse disabled:opacity-60"
          >
            {busy ? 'Submitting…' : 'Submit clip'}
          </button>
        </form>
      )}
    </div>
  );
}
