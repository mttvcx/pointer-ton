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
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="text-[13px] text-fg-muted">Connect accounts, verify audience, payouts, appeals.</p>
      </div>

      <section className="rounded-lg border border-border-subtle bg-bg-raised p-4">
        <h2 className="text-[13px] font-semibold">Profile</h2>
        <p className="mt-1 text-[12px] text-fg-muted">Discord · {meQ.data?.creator.discordUsername ?? '…'}</p>
      </section>

      <CreatorAccountsPanel
        accounts={accounts}
        showAddForm
        initialVerifyAccountId={verifyAccountId}
      />

      <section className="rounded-lg border border-border-subtle bg-bg-raised p-4">
        <h2 className="text-[13px] font-semibold">Appeal a rejection or ban</h2>
        <form onSubmit={(e) => void submitAppeal(e)} className="mt-2 space-y-2">
          <textarea
            value={appealMsg}
            onChange={(e) => setAppealMsg(e.target.value)}
            rows={4}
            placeholder="Explain with concrete proof…"
            className="w-full rounded-md border border-border-subtle bg-bg-sunken px-3 py-2 text-[13px]"
            minLength={20}
            required
          />
          <button type="submit" className="rounded-md border border-border-subtle px-4 py-2 text-[12px] font-semibold hover:bg-bg-hover">
            Submit appeal
          </button>
        </form>
      </section>
    </div>
  );
}
