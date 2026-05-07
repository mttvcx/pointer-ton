'use client';

import { useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import { APP_NAME } from '@/lib/utils/constants';

export function ReferralDashboard({ className }: { className?: string }) {
  const { getAccessToken } = usePointerAuth();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const urlApplyCode = searchParams.get('code')?.trim() ?? '';
  const [applyDraft, setApplyDraft] = useState('');
  const applyValue = applyDraft || urlApplyCode;
  const [vanity, setVanity] = useState('');
  const [shareOpen, setShareOpen] = useState(false);

  const headers = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) throw new Error('no_token');
    return { Authorization: `Bearer ${token}` };
  }, [getAccessToken]);

  const { data: codeData, isLoading: codeLoading } = useQuery({
    queryKey: ['referral-code'],
    queryFn: async () => {
      const res = await fetch('/api/referrals/code', { headers: await headers() });
      if (!res.ok) throw new Error('code');
      return res.json() as Promise<{
        code: string;
        usesCount: number;
        referredCount: number;
        earnings: { paid: number; pending: number; total: number };
        feeShareBps: number;
      }>;
    },
  });

  const { data: earnData, isLoading: earnLoading } = useQuery({
    queryKey: ['referral-earnings'],
    queryFn: async () => {
      const res = await fetch('/api/referrals/earnings?limit=30', { headers: await headers() });
      if (!res.ok) throw new Error('earnings');
      return res.json() as Promise<{
        sums: { paidSol: number; pendingSol: number; totalSol: number };
        recent: Array<{
          id: string;
          amountSol: number;
          paidOut: boolean;
          createdAt: string;
        }>;
      }>;
    },
  });

  const applyMut = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch('/api/referrals/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await headers()) },
        body: JSON.stringify({ code }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? 'apply_failed');
    },
    onSuccess: () => {
      toast.success('Referral applied');
      setApplyDraft('');
      void qc.invalidateQueries({ queryKey: ['referral-code'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Apply failed'),
  });

  const vanityMut = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch('/api/referrals/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await headers()) },
        body: JSON.stringify({ code }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? 'claim_failed');
    },
    onSuccess: () => {
      toast.success('Referral code updated');
      setVanity('');
      void qc.invalidateQueries({ queryKey: ['referral-code'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not claim code'),
  });

  const sharePct =
    codeData?.feeShareBps != null ? (codeData.feeShareBps / 100).toFixed(0) : '30';
  const shareUrl =
    typeof window !== 'undefined' && codeData?.code
      ? `${window.location.origin}/referral?code=${encodeURIComponent(codeData.code)}`
      : '';

  const prefilledTweet = `${APP_NAME}: trading with AI. Use my code ${codeData?.code ?? ''} ${shareUrl}`;

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-6', className)}>
      <section className="rounded-md border border-border-subtle p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
          Your code
        </h2>
        {codeLoading || !codeData ? (
          <Loader2 className="mt-3 h-5 w-5 animate-spin text-fg-muted" />
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-sm border border-border-subtle bg-bg-base px-3 py-1.5 tabular-nums text-sm font-semibold tracking-wide text-fg-primary">
              {codeData.code}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-sm border border-border-subtle px-2 py-1 text-[11px] text-fg-secondary hover:bg-bg-hover"
              onClick={() => {
                void navigator.clipboard.writeText(codeData.code);
                toast.success('Copied');
              }}
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-sm border border-border-subtle px-2 py-1 text-[11px] text-fg-secondary hover:bg-bg-hover"
              onClick={() => setShareOpen(true)}
            >
              <Share2 className="h-3 w-3" /> Share
            </button>
          </div>
        )}
        <p className="mt-3 text-[12px] leading-relaxed text-fg-secondary">
          {sharePct}% of every fee your referees pay. Forever. Same rate for everyone.
        </p>
        {codeData ? (
          <p className="mt-2 text-[11px] text-fg-muted">
            Uses: <span className="tabular-nums tabular-nums">{codeData.usesCount}</span>
            <span className="mx-1 text-fg-muted">|</span>
            Referred:{' '}
            <span className="tabular-nums tabular-nums">{codeData.referredCount}</span>
          </p>
        ) : null}
        <div className="mt-4 border-t border-border-subtle pt-4">
          <label className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">
            Claim vanity code (4-12 chars, A-Z / 2-9)
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              value={vanity}
              onChange={(e) => setVanity(e.target.value.toUpperCase())}
              className="min-w-[140px] flex-1 rounded-sm border border-border-subtle bg-bg-base px-2 py-1.5 tabular-nums text-[13px] uppercase focus-ring"
              maxLength={12}
              placeholder="MYCODE"
            />
            <button
              type="button"
              disabled={vanityMut.isPending || vanity.length < 4}
              onClick={() => vanityMut.mutate(vanity)}
              className="rounded-sm bg-accent-primary px-3 py-1.5 text-[12px] font-medium text-fg-inverse disabled:opacity-40"
            >
              {vanityMut.isPending ? 'Saving' : 'Save'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-border-subtle p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
          Apply a code (once)
        </h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={applyValue}
            onChange={(e) => setApplyDraft(e.target.value)}
            className="min-w-[160px] flex-1 rounded-sm border border-border-subtle bg-bg-base px-2 py-1.5 tabular-nums text-[13px] focus-ring"
            placeholder="Friend or KOL code"
          />
          <button
            type="button"
            disabled={applyMut.isPending || !applyValue.trim()}
            onClick={() => applyMut.mutate(applyValue.trim())}
            className="rounded-sm border border-border-subtle px-3 py-1.5 text-[12px] font-medium text-fg-primary hover:bg-bg-hover disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      </section>

      <section className="rounded-md border border-border-subtle p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
          Earnings
        </h2>
        {earnLoading || !earnData ? (
          <Loader2 className="mt-3 h-5 w-5 animate-spin text-fg-muted" />
        ) : (
          <>
            <div className="mt-3 grid gap-2 tabular-nums text-[13px] tabular-nums sm:grid-cols-3">
              <div>
                <p className="text-[10px] uppercase text-fg-muted">Pending SOL</p>
                <p className="text-fg-primary">{formatNumber(earnData.sums.pendingSol, { decimals: 4 })}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-fg-muted">Paid SOL</p>
                <p className="text-fg-primary">{formatNumber(earnData.sums.paidSol, { decimals: 4 })}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-fg-muted">Total SOL</p>
                <p className="text-fg-primary">{formatNumber(earnData.sums.totalSol, { decimals: 4 })}</p>
              </div>
            </div>
            <div className="mt-4 max-h-64 overflow-auto rounded-sm border border-border-subtle">
              <table className="w-full border-collapse text-left text-[12px]">
                <thead className="sticky top-0 border-b border-border-subtle bg-bg-base text-[10px] uppercase text-fg-muted">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">SOL</th>
                    <th className="px-2 py-1.5 font-medium">Status</th>
                    <th className="px-2 py-1.5 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {earnData.recent.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-2 py-4 text-center text-fg-muted">
                        No referral fees yet.
                      </td>
                    </tr>
                  ) : (
                    earnData.recent.map((r) => (
                      <tr key={r.id} className="border-b border-border-subtle last:border-b-0">
                        <td className="px-2 py-1.5 tabular-nums tabular-nums">
                          {formatNumber(r.amountSol, { decimals: 5 })}
                        </td>
                        <td className="px-2 py-1.5 text-fg-secondary">
                          {r.paidOut ? 'Paid' : 'Pending'}
                        </td>
                        <td className="px-2 py-1.5 text-fg-muted">
                          {new Date(r.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
        <p className="mt-3 text-[11px] text-fg-muted">
          Payouts are manual in Phase 2. {/* TODO Phase 3 */}
        </p>
      </section>

      {shareOpen ? (
        <div
          className="fixed inset-0 z-[100] flex animate-in fade-in items-center justify-center bg-black/60 px-4 duration-200"
          role="dialog"
          aria-modal
        >
          <div className="w-full max-w-md animate-in zoom-in-95 fade-in rounded-lg border border-border-subtle bg-bg-base p-5 shadow-xl duration-200">
            <h3 className="text-sm font-semibold text-fg-primary">Share your code</h3>
            <p className="mt-2 break-all tabular-nums text-[12px] text-fg-secondary">{prefilledTweet}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(prefilledTweet)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-sm bg-accent-primary px-3 py-1.5 text-[12px] font-medium text-fg-inverse"
              >
                Post on X
              </a>
              <button
                type="button"
                className="rounded-sm border border-border-subtle px-3 py-1.5 text-[12px] text-fg-secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(prefilledTweet);
                  toast.success('Copied message');
                }}
              >
                Copy message
              </button>
              <button
                type="button"
                className="rounded-sm border border-border-subtle px-3 py-1.5 text-[12px] text-fg-secondary"
                onClick={() => setShareOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
