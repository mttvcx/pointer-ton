'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CreatorAccountsPanel } from '@/components/creators/CreatorAccountsPanel';
import type { CreatorPlatform } from '@/lib/creators/config';

export default function CreatorSettingsPage() {
  const searchParams = useSearchParams();
  const verifyAccountId = searchParams.get('verify');
  const meQ = useQuery({
    queryKey: ['creator-me'],
    queryFn: async () => {
      const res = await fetch('/api/creators/me');
      return res.json() as Promise<{
        creator: { payoutMethod: string | null; payoutAddress: string | null; discordUsername: string };
        accounts: Array<{
          id: string;
          platform: CreatorPlatform;
          handle: string;
          verification_status: string;
          tier: string | null;
        }>;
      }>;
    },
  });

  const [appealMsg, setAppealMsg] = useState('');

  async function submitAppeal(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/creators/appeals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetType: 'ban', message: appealMsg }),
    });
    if (!res.ok) {
      toast.error('Appeal failed');
      return;
    }
    toast.success('Appeal submitted');
    setAppealMsg('');
  }

  const accounts = meQ.data?.accounts ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-[13px] text-fg-muted">Connect accounts, verify audience, payouts, appeals.</p>
      </div>

      <section className="creator-glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold tracking-tight">Profile</h2>
        <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5865F2]/20 text-[13px] font-bold text-[#8b96ff] ring-1 ring-[#5865F2]/30">
            {(meQ.data?.creator.discordUsername ?? '·').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">Discord</p>
            <p className="truncate text-[13px] font-medium">{meQ.data?.creator.discordUsername ?? '…'}</p>
          </div>
        </div>
      </section>

      <CreatorAccountsPanel
        accounts={accounts}
        showAddForm
        initialVerifyAccountId={verifyAccountId}
      />

      <section className="creator-glass rounded-2xl p-5">
        <h2 className="text-sm font-semibold tracking-tight">Appeal a rejection or ban</h2>
        <p className="mt-0.5 text-[12px] text-fg-muted">Include concrete proof — screenshots, analytics, original post.</p>
        <form onSubmit={(e) => void submitAppeal(e)} className="mt-3 space-y-3">
          <textarea
            value={appealMsg}
            onChange={(e) => setAppealMsg(e.target.value)}
            rows={4}
            placeholder="Explain with concrete proof…"
            className="creator-field w-full resize-none rounded-xl px-3 py-2.5 text-[13px] text-fg-primary placeholder:text-fg-muted"
            minLength={20}
            required
          />
          <button
            type="submit"
            className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-[12px] font-semibold transition-colors hover:border-accent-primary/40 hover:bg-accent-primary/10"
          >
            Submit appeal
          </button>
        </form>
      </section>
    </div>
  );
}
