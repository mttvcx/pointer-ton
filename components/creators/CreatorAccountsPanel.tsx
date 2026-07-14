'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  AudienceVerificationModal,
  type VerificationAccount,
} from '@/components/creators/AudienceVerificationModal';
import { CreatorSelect } from '@/components/creators/CreatorSelect';
import type { CreatorPlatform } from '@/lib/creators/config';
import {
  verificationStatusLabel,
  verificationStatusTone,
} from '@/lib/creators/verificationGuide';
import { cn } from '@/lib/utils/cn';

export type CreatorSocialAccount = {
  id: string;
  platform: CreatorPlatform;
  handle: string;
  verification_status: string;
  tier: string | null;
};

const TONE_CLASS = {
  warn: 'bg-signal-warn/15 text-signal-warn ring-signal-warn/25',
  pending: 'bg-accent-primary/15 text-accent-glow ring-accent-primary/25',
  ok: 'bg-signal-bull/15 text-signal-bull ring-signal-bull/25',
  bad: 'bg-signal-bear/15 text-signal-bear ring-signal-bear/25',
  muted: 'bg-bg-sunken text-fg-muted ring-border-subtle',
} as const;

type CreatorAccountsPanelProps = {
  accounts: CreatorSocialAccount[];
  /** Auto-open verify modal for this account id */
  initialVerifyAccountId?: string | null;
  showAddForm?: boolean;
  compact?: boolean;
};

export function CreatorAccountsPanel({
  accounts,
  initialVerifyAccountId = null,
  showAddForm = true,
  compact = false,
}: CreatorAccountsPanelProps) {
  const qc = useQueryClient();
  const [platform, setPlatform] = useState<CreatorPlatform>('tiktok');
  const [handle, setHandle] = useState('');
  const [verifyTarget, setVerifyTarget] = useState<VerificationAccount | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!initialVerifyAccountId || accounts.length === 0) return;
    const hit = accounts.find((a) => a.id === initialVerifyAccountId);
    if (hit) {
      setVerifyTarget(hit);
      setModalOpen(true);
    }
  }, [initialVerifyAccountId, accounts]);

  const needsVerificationCount = useMemo(
    () => accounts.filter((a) => a.verification_status === 'needs_verification' || a.verification_status === 'rejected').length,
    [accounts],
  );

  function openVerify(account: CreatorSocialAccount) {
    setVerifyTarget(account);
    setModalOpen(true);
  }

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/creators/accounts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ platform, handle }),
    });
    const j = (await res.json()) as { error?: string; account?: CreatorSocialAccount };
    if (!res.ok) {
      toast.error('Could not add account');
      return;
    }
    toast.success('Account linked — complete verification');
    setHandle('');
    void qc.invalidateQueries({ queryKey: ['creator-me'] });
    void qc.invalidateQueries({ queryKey: ['creator-accounts'] });
    if (j.account) {
      setVerifyTarget(j.account);
      setModalOpen(true);
    }
  }

  return (
    <>
      <section className={cn('creator-glass rounded-2xl', compact ? 'p-3' : 'p-5')}>
        {!compact && needsVerificationCount > 0 ? (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-signal-warn/30 bg-signal-warn/10 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-signal-warn" />
            <div>
              <p className="text-[12px] font-semibold text-fg-primary">Verification required</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-fg-muted">
                {needsVerificationCount} account{needsVerificationCount === 1 ? '' : 's'} need audience proof before you can submit clips.
                Watch the example video and upload one continuous recording.
              </p>
            </div>
          </div>
        ) : null}

        {showAddForm ? (
          <>
            <h2 className="text-sm font-semibold tracking-tight">Connect social account</h2>
            <p className="mt-0.5 text-[12px] text-fg-muted">Link where you post your Pointer clips.</p>
            <form onSubmit={(e) => void addAccount(e)} className="mt-3.5 flex flex-wrap items-stretch gap-2">
              <CreatorSelect
                value={platform}
                onChange={(v) => setPlatform(v as CreatorPlatform)}
                ariaLabel="Platform"
                className="w-32"
                options={[
                  { value: 'tiktok', label: 'TikTok' },
                  { value: 'instagram', label: 'Instagram' },
                  { value: 'x', label: 'X' },
                ]}
              />
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@handle"
                className="creator-field min-w-[8rem] flex-1 rounded-lg px-3 py-2 text-[13px] text-fg-primary placeholder:text-fg-muted"
              />
              <button
                type="submit"
                className="creator-btn-primary rounded-lg px-5 py-2 text-[12px] font-semibold text-white"
              >
                Add
              </button>
            </form>
          </>
        ) : (
          <h2 className="text-sm font-semibold tracking-tight">Your accounts</h2>
        )}

        <ul className={cn('space-y-2', showAddForm ? 'mt-4' : 'mt-3')}>
          {accounts.length === 0 ? (
            <li className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-[12px] text-fg-muted">
              No accounts linked yet.
            </li>
          ) : (
            accounts.map((a) => {
              const tone = verificationStatusTone(a.verification_status);
              const showVerifyBtn =
                a.verification_status === 'needs_verification' ||
                a.verification_status === 'rejected' ||
                a.verification_status === 'pending' ||
                a.verification_status === 'verified';

              return (
                <li
                  key={a.id}
                  className="creator-glass-quiet creator-interactive flex flex-wrap items-center justify-between gap-2 rounded-xl px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium capitalize">
                      {a.platform} · @{a.handle}
                    </p>
                    {a.tier ? (
                      <p className="text-[10px] uppercase tracking-wide text-fg-muted">{a.tier} tier</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset',
                        TONE_CLASS[tone],
                      )}
                    >
                      {verificationStatusLabel(a.verification_status)}
                    </span>
                    {showVerifyBtn ? (
                      <button
                        type="button"
                        onClick={() => openVerify(a)}
                        className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold transition-colors hover:border-accent-primary/40 hover:bg-accent-primary/10"
                      >
                        {a.verification_status === 'needs_verification' || a.verification_status === 'rejected'
                          ? 'Verify'
                          : 'View'}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <AudienceVerificationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        account={verifyTarget}
        onSubmitted={() => {
          void qc.invalidateQueries({ queryKey: ['creator-me'] });
          void qc.invalidateQueries({ queryKey: ['creator-accounts'] });
        }}
      />
    </>
  );
}
