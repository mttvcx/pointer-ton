'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CreatorSelect } from '@/components/creators/CreatorSelect';

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
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Submit Video</h1>
        <p className="mt-0.5 text-[13px] text-fg-muted">Paste the public URL after posting your Pointer clip.</p>
      </div>

      {accounts.length === 0 ? (
        <div className="creator-glass rounded-2xl p-5 text-[13px] text-fg-secondary">
          <p>Verify a TikTok, Instagram, or X account before submitting clips.</p>
          <Link
            href="/portal/settings"
            className="creator-btn-primary mt-4 inline-flex rounded-lg px-4 py-2 text-[12px] font-semibold text-white"
          >
            Verify account
          </Link>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="creator-glass space-y-4 rounded-2xl p-5">
          <div>
            <label className="block text-[12px] font-medium text-fg-secondary">Account</label>
            <CreatorSelect
              value={accountId}
              onChange={setAccountId}
              placeholder="Select account…"
              ariaLabel="Account"
              className="mt-1.5"
              options={accounts.map((a) => ({ value: a.id, label: `${a.platform} · @${a.handle}` }))}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-fg-secondary">Post URL</label>
            <input
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              placeholder="https://…"
              className="creator-field mt-1.5 w-full rounded-lg px-3 py-2 text-[13px] text-fg-primary placeholder:text-fg-muted"
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy || !accountId}
            className="creator-btn-primary w-full rounded-lg py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Submitting…' : 'Submit clip'}
          </button>
        </form>
      )}
    </div>
  );
}
