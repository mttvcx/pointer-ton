'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  Copy,
  Gift,
  Link2,
  Loader2,
  Radio,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatNumber, formatRelativeTime } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import { APP_NAME } from '@/lib/utils/constants';
import { GlassPanel, HeroBackdrop } from '@/components/points/missionControlPrimitives';
import { buildReferralInviteUrl } from '@/lib/referral/referralUrls';

function displayInviteName(user: {
  twitter?: { username?: string };
  google?: { name?: string };
  email?: { address?: string };
} | null): string {
  if (!user) return 'Operator';
  const tw = user.twitter?.username?.trim();
  if (tw) return `@${tw}`;
  const g = user.google?.name?.trim();
  if (g) return g;
  const em = user.email?.address?.trim();
  if (em) return em.includes('@') ? em.split('@')[0] ?? em : em;
  return 'Operator';
}

export function ReferralDashboard({ className }: { className?: string }) {
  const { getAccessToken, user } = usePointerAuth();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const urlApplyCode = searchParams.get('code')?.trim() ?? '';
  const [applyDraft, setApplyDraft] = useState('');
  const applyValue = applyDraft || urlApplyCode;
  const [vanity, setVanity] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const operatorLabel = displayInviteName(user);

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
  const shareUrl = codeData?.code ? buildReferralInviteUrl(codeData.code) : '';

  const xShareMessage = codeData?.code
    ? `50% cashback. Forever.\nUse my referral code: "${codeData.code}"`
    : '';

  const loading = codeLoading || earnLoading;

  return (
    <div className={cn('relative flex min-h-0 flex-1 flex-col', className)}>
      <HeroBackdrop />

      <div className="relative z-[1] space-y-6 p-4 sm:p-5 lg:p-6">
        {/* Hero */}
        <GlassPanel variant="hero" glow="cyan" className="overflow-hidden p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-bg-sunken/90 px-3 py-1.5 text-[11px] text-fg-secondary shadow-inner ring-1 ring-cyan-500/15">
                <Radio className="h-3.5 w-3.5 text-accent-glow" aria-hidden />
                <span className="font-semibold uppercase tracking-[0.14em] text-fg-muted">Referral command</span>
                <span className="rounded-md bg-violet-500/15 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-violet-100 ring-1 ring-violet-400/25">
                  Forever fees
                </span>
              </div>
              <h2 className="font-semibold tracking-tight text-fg-primary text-[clamp(1.35rem,2.8vw,1.75rem)] leading-tight">
                Invite serious traders.
                <span className="block bg-gradient-to-r from-fg-primary via-accent-glow to-violet-300 bg-clip-text text-transparent">
                  Earn forever.
                </span>
              </h2>
              <p className="text-[12px] leading-relaxed text-fg-secondary">
                Share your invite link with operators who actually trade. You earn a transparent fee share on their
                activity — no spam quests, no timeline farming.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-bg-base/55 px-5 py-4 shadow-inner ring-1 ring-cyan-400/15 backdrop-blur-md lg:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-muted">Logged in as</p>
              <p className="mt-1 text-[15px] font-semibold text-fg-primary">{operatorLabel}</p>
              <p className="mt-2 text-[11px] text-fg-muted">
                Fee share <span className="tabular-nums font-bold text-accent-glow">{sharePct}%</span> · same rules for
                everyone
              </p>
            </div>
          </div>
        </GlassPanel>

        {loading || !codeData || !earnData ? (
          <div className="flex min-h-[200px] items-center justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-accent-primary" />
          </div>
        ) : (
          <>
            {/* Your code — primary */}
            <div className="grid gap-4 xl:grid-cols-5 xl:items-stretch">
              <GlassPanel variant="primary" glow="violet" className="p-5 sm:p-6 xl:col-span-3">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet-100/90">
                      Your invite code
                    </h3>
                    <p className="mt-1 text-[11px] text-fg-muted">Copy or share — attribution stays on your link.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="focus-ring btn-press inline-flex items-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-4 py-2.5 text-[12px] font-semibold text-cyan-50 shadow-[0_0_24px_-12px_rgba(34,211,238,0.45)] ring-1 ring-cyan-400/25 transition hover:bg-cyan-500/15"
                      onClick={() => {
                        void navigator.clipboard.writeText(codeData.code);
                        toast.success('Code copied');
                      }}
                    >
                      <Copy className="h-4 w-4" />
                      Copy code
                    </button>
                    <button
                      type="button"
                      className="focus-ring btn-press inline-flex items-center gap-2 rounded-xl border border-white/12 bg-bg-hover/90 px-4 py-2.5 text-[12px] font-semibold text-fg-primary ring-1 ring-white/[0.06] transition hover:border-violet-400/35"
                      onClick={() => setShareOpen(true)}
                    >
                      <Share2 className="h-4 w-4 opacity-90" />
                      Share link
                    </button>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-bg-hover/70 to-bg-base/90 p-5 shadow-inner ring-1 ring-white/[0.05]">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="break-all font-mono text-[clamp(1.25rem,4vw,1.85rem)] font-bold tracking-[0.12em] text-fg-primary">
                      {codeData.code}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-signal-bull/25 bg-signal-bull/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-signal-bull ring-1 ring-signal-bull/20">
                      <Check className="h-3 w-3" aria-hidden />
                      Active
                    </span>
                  </div>
                  <p className="mt-4 text-[12px] leading-relaxed text-fg-secondary">
                    <span className="tabular-nums font-semibold text-fg-primary">{sharePct}%</span> of fees from
                    referees — long-term, disclosed economics.
                  </p>
                </div>

                <div className="mt-6 border-t border-white/[0.06] pt-5">
                  <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
                    Reserve vanity invite code
                  </label>
                  <p className="mt-1 text-[11px] text-fg-muted">4–12 chars · A–Z / 2–9</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      value={vanity}
                      onChange={(e) => setVanity(e.target.value.toUpperCase())}
                      className="focus-ring min-w-[160px] flex-1 rounded-xl border border-white/[0.08] bg-bg-base/80 px-3 py-2.5 tabular-nums text-[13px] uppercase text-fg-primary ring-1 ring-white/[0.04] placeholder:text-fg-muted"
                      maxLength={12}
                      placeholder="MYCODE"
                    />
                    <button
                      type="button"
                      disabled={vanityMut.isPending || vanity.length < 4}
                      onClick={() => vanityMut.mutate(vanity)}
                      className="focus-ring btn-press rounded-xl bg-accent-primary px-5 py-2.5 text-[12px] font-semibold text-fg-inverse shadow-[0_0_24px_-8px_rgb(var(--accent-primary-rgb)/0.55)] disabled:opacity-40"
                    >
                      {vanityMut.isPending ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              </GlassPanel>

              {/* Share preview */}
              <GlassPanel variant="secondary" className="flex flex-col p-5 sm:p-6 xl:col-span-2">
                <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-muted">
                  <Link2 className="h-3.5 w-3.5 text-accent-glow" aria-hidden />
                  Link preview
                </div>
                <div className="flex flex-1 flex-col rounded-xl border border-white/[0.07] bg-bg-base/60 p-4 ring-1 ring-white/[0.04]">
                  <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent-primary/40 to-violet-600/40 shadow-inner ring-1 ring-white/10">
                      <Sparkles className="h-4 w-4 text-fg-primary" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-fg-primary">{APP_NAME} invite</p>
                      <p className="truncate text-[10px] text-fg-muted">pointer.xyz · referral</p>
                    </div>
                  </div>
                  <p className="mt-3 flex-1 break-all text-[11px] leading-relaxed text-fg-secondary">
                    {shareUrl || '…'}
                  </p>
                  <button
                    type="button"
                    className="focus-ring btn-press mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 py-2.5 text-[12px] font-semibold text-cyan-50 ring-1 ring-cyan-400/20 transition hover:bg-cyan-500/15"
                    onClick={() => {
                      void navigator.clipboard.writeText(shareUrl);
                      toast.success('Invite link copied');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    Copy invite URL
                  </button>
                </div>
              </GlassPanel>
            </div>

            {/* Metrics */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <GlassPanel variant="secondary" className="p-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
                  <Users className="h-3.5 w-3.5 text-violet-300" aria-hidden />
                  Referred traders
                </div>
                <p className="mt-2 text-[22px] font-bold tabular-nums tracking-tight text-fg-primary">
                  {formatNumber(codeData.referredCount, { decimals: 0 })}
                </p>
                <p className="mt-1 text-[11px] text-fg-muted">Signed up with your attribution</p>
              </GlassPanel>
              <GlassPanel variant="secondary" className="p-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
                  <TrendingUp className="h-3.5 w-3.5 text-accent-glow" aria-hidden />
                  Code uses
                </div>
                <p className="mt-2 text-[22px] font-bold tabular-nums tracking-tight text-fg-primary">
                  {formatNumber(codeData.usesCount, { decimals: 0 })}
                </p>
                <p className="mt-1 text-[11px] text-fg-muted">Invokes · includes repeats</p>
              </GlassPanel>
              <GlassPanel variant="secondary" className="p-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
                  <Gift className="h-3.5 w-3.5 text-signal-bull" aria-hidden />
                  Lifetime referral fees
                </div>
                <p className="mt-2 text-[22px] font-bold tabular-nums tracking-tight text-fg-primary">
                  {formatNumber(codeData.earnings.total, { decimals: 4 })}
                </p>
                <p className="mt-1 text-[11px] text-fg-muted">SOL · aggregate credited</p>
              </GlassPanel>
              <GlassPanel variant="secondary" className="p-4 ring-1 ring-cyan-400/15">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
                      <Wallet className="h-3.5 w-3.5 text-cyan-200" aria-hidden />
                      Pending settlement
                    </div>
                    <p className="mt-2 text-[22px] font-bold tabular-nums tracking-tight text-accent-glow">
                      {formatNumber(earnData.sums.pendingSol, { decimals: 4 })}
                    </p>
                    <p className="mt-1 text-[11px] text-fg-muted">SOL · payouts follow roadmap</p>
                  </div>
                  <Link
                    href="/points?tab=rewards#rewards-claim-hub"
                    className="focus-ring btn-press shrink-0 rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 text-[11px] font-semibold text-cyan-50 ring-1 ring-cyan-400/22 transition hover:bg-cyan-500/15"
                  >
                    Checkpoint
                  </Link>
                </div>
              </GlassPanel>
            </div>

            {/* Apply code */}
            <GlassPanel variant="quiet" glow="cyan" className="p-5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-muted">Apply an invite code</h3>
              <p className="mt-1 text-[11px] text-fg-muted">One-time · use a friend or partner code</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <input
                  value={applyValue}
                  onChange={(e) => setApplyDraft(e.target.value)}
                  className="focus-ring min-w-[200px] flex-1 rounded-xl border border-white/[0.08] bg-bg-base/70 px-3 py-2.5 text-[13px] text-fg-primary ring-1 ring-white/[0.04]"
                  placeholder="Friend or partner code"
                />
                <button
                  type="button"
                  disabled={applyMut.isPending || !applyValue.trim()}
                  onClick={() => applyMut.mutate(applyValue.trim())}
                  className="focus-ring btn-press inline-flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-5 py-2.5 text-[12px] font-semibold text-violet-100 ring-1 ring-violet-400/20 disabled:opacity-40"
                >
                  Apply
                  <ArrowRight className="h-4 w-4 opacity-80" />
                </button>
              </div>
            </GlassPanel>

            {/* Earnings */}
            <GlassPanel variant="quiet" className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-muted">Earnings ledger</h3>
                <div className="flex flex-wrap gap-4 text-[11px] tabular-nums">
                  <span className="text-fg-muted">
                    Paid <span className="font-semibold text-fg-primary">{formatNumber(earnData.sums.paidSol, { decimals: 4 })}</span> SOL
                  </span>
                  <span className="text-fg-muted">
                    Total <span className="font-semibold text-fg-primary">{formatNumber(earnData.sums.totalSol, { decimals: 4 })}</span> SOL
                  </span>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-white/[0.06] ring-1 ring-white/[0.03]">
                <div className="max-h-72 overflow-auto">
                  <table className="w-full border-collapse text-left text-[12px]">
                    <thead className="sticky top-0 z-[1] bg-bg-raised/95 backdrop-blur">
                      <tr className="border-b border-white/[0.06]">
                        <th className="px-3 py-2.5 font-semibold text-fg-muted">SOL</th>
                        <th className="px-3 py-2.5 font-semibold text-fg-muted">Status</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-fg-muted">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {earnData.recent.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-10 text-center text-fg-muted">
                            No referral fees yet — share your link with active traders.
                          </td>
                        </tr>
                      ) : (
                        earnData.recent.map((r, i) => (
                          <tr
                            key={r.id}
                            className={cn(
                              'border-b border-white/[0.05] transition hover:bg-bg-hover/40',
                              i % 2 === 0 ? 'bg-bg-base/35' : '',
                            )}
                          >
                            <td className="px-3 py-2.5 tabular-nums font-medium text-fg-primary">
                              {formatNumber(r.amountSol, { decimals: 5 })}
                            </td>
                            <td className="px-3 py-2.5 text-fg-secondary">{r.paidOut ? 'Paid' : 'Pending'}</td>
                            <td className="px-3 py-2.5 text-right text-fg-muted">{formatRelativeTime(r.createdAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-fg-muted">
                Settlement cadence follows product roadmap — phases disclosed in-app.
              </p>
            </GlassPanel>
          </>
        )}
      </div>

      {shareOpen ? (
        <div
          className="fixed inset-0 z-[120] flex animate-in fade-in items-center justify-center bg-black/70 px-4 backdrop-blur-sm duration-200"
          role="dialog"
          aria-modal
        >
          <GlassPanel variant="hero" glow="cyan" className="w-full max-w-lg p-6 shadow-2xl ring-1 ring-cyan-400/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[15px] font-semibold text-fg-primary">Share invite</h3>
                <p className="mt-1 text-[12px] text-fg-secondary">
                  Share the link — serious traders only. No points for spam posting.
                </p>
              </div>
              <button
                type="button"
                className="focus-ring rounded-lg border border-white/10 p-2 text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary"
                onClick={() => setShareOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 whitespace-pre-line rounded-xl border border-white/[0.08] bg-bg-sunken/80 p-4 text-[11px] leading-relaxed text-fg-secondary ring-1 ring-white/[0.04]">
              {xShareMessage}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="focus-ring btn-press inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/12 bg-bg-hover px-4 py-2.5 text-[12px] font-semibold text-fg-primary min-[400px]:flex-none"
                onClick={() => {
                  void navigator.clipboard.writeText(shareUrl);
                  toast.success('Invite link copied');
                }}
              >
                <Link2 className="h-4 w-4" />
                Copy link
              </button>
              <button
                type="button"
                className="focus-ring btn-press inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/12 bg-bg-hover px-4 py-2.5 text-[12px] font-semibold text-fg-primary min-[400px]:flex-none"
                onClick={() => {
                  void navigator.clipboard.writeText(xShareMessage);
                  toast.success('Message copied');
                }}
              >
                <Copy className="h-4 w-4" />
                Copy message
              </button>
            </div>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(xShareMessage)}`}
              target="_blank"
              rel="noreferrer"
              className="focus-ring btn-press mt-3 flex w-full items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 py-2.5 text-[12px] font-semibold text-cyan-50 ring-1 ring-cyan-400/25 transition hover:bg-cyan-500/15"
            >
              Open X composer
              <ArrowRight className="ml-2 h-4 w-4 opacity-80" />
            </a>
          </GlassPanel>
        </div>
      ) : null}

    </div>
  );
}
