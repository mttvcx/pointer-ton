'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Compass,
  Loader2,
  Radio,
  Search,
  Share2,
  Shield,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { buildReferralInviteUrl } from '@/lib/referral/referralUrls';
import { formatNumber } from '@/lib/utils/formatters';
import type { LeaderboardPageResult } from '@/lib/points/leaderboardTypes';
import { PointerBirdMark } from '@/components/branding/PointerBirdMark';
import { ReferralDashboard } from '@/components/referral/ReferralDashboard';
import { RewardsClaimHub } from '@/components/rewards/RewardsClaimHub';
import { CampaignRadarSection } from '@/components/points/CampaignRadar';
import { ChainGlyph } from '@/components/points/ChainGlyph';
import { GlassPanel, HeroBackdrop } from '@/components/points/missionControlPrimitives';
import {
  CREATOR_PROGRAM_COPY,
  ECOSYSTEM_CAMPAIGNS,
  ECOSYSTEM_NODE_VISUAL,
  POINTS_LAST_UPDATED_LABEL,
  POINTS_RULES_VERSION,
  POINTS_SEASON_LABEL,
  RANK_LADDER,
  SOCIAL_IDENTITY_COPY,
  TRANSPARENCY_BULLETS,
  rankTierFromPoints,
  type EcosystemCampaignId,
  type RankTierId,
} from '@/components/points/pointsUiConfig';

type RewardsTab = 'rewards' | 'leaderboard' | 'referral' | 'benefits';

type LeaderboardBoard = 'traders' | 'referrers' | 'creators';

function parseRewardsTab(raw: string | null): RewardsTab {
  const t = raw?.trim().toLowerCase();
  if (t === 'rewards' || t === 'leaderboard' || t === 'benefits' || t === 'referral') return t;
  return 'rewards';
}

function parseLeaderboardBoard(raw: string | null): LeaderboardBoard {
  const b = raw?.trim().toLowerCase();
  if (b === 'referrers' || b === 'creators') return b;
  return 'traders';
}

function parseCampaignHighlight(raw: string | null): EcosystemCampaignId | null {
  const c = raw?.trim().toLowerCase();
  const ids: EcosystemCampaignId[] = ['sol', 'ton', 'base', 'bnb', 'hyperliquid'];
  return ids.includes(c as EcosystemCampaignId) ? (c as EcosystemCampaignId) : null;
}

function shortenAddress(value: string, chars = 4) {
  if (!value) return '';
  if (value.length <= chars * 2 + 1) return value;
  return `${value.slice(0, chars)}...${value.slice(-chars)}`;
}

function displayNameFromUser(user: {
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

async function authFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `request_${res.status}`);
  }
  return res.json() as Promise<T>;
}

function rankTierIndex(id: RankTierId): number {
  const i = RANK_LADDER.findIndex((t) => t.id === id);
  return i < 0 ? 0 : i;
}

function RankSeal({ label }: { label: string }) {
  const initials = label.slice(0, 2).toUpperCase();
  return (
    <div className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center">
      <div className="pointer-events-none absolute inset-0 animate-pulse-soft rounded-2xl bg-gradient-to-br from-cyan-400/20 via-accent-primary/25 to-violet-500/30 blur-xl" />
      <div className="relative flex h-[68px] w-[68px] items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-bg-hover/95 to-bg-base/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_14px_44px_-10px_rgba(0,163,224,0.55)] ring-1 ring-cyan-400/30">
        <span className="bg-gradient-to-br from-white via-fg-primary to-fg-secondary bg-clip-text text-[18px] font-bold tracking-tight text-transparent">
          {initials}
        </span>
      </div>
    </div>
  );
}

function RankMiniLadder({ currentId }: { currentId: RankTierId }) {
  const idx = rankTierIndex(currentId);
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-fg-muted">Prestige ladder</p>
      <div className="flex gap-0.5 sm:gap-1">
        {RANK_LADDER.map((t, i) => {
          const reached = i <= idx;
          const current = i === idx;
          return (
            <div key={t.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  'h-2 w-full rounded-full transition-all duration-300',
                  reached
                    ? 'bg-gradient-to-r from-cyan-400/85 via-accent-primary to-violet-500/85 shadow-[0_0_14px_rgba(0,163,224,0.45)]'
                    : 'bg-bg-base ring-1 ring-white/[0.06]',
                  current && 'ring-1 ring-cyan-300/45',
                )}
              />
              <span
                className={cn(
                  'block max-w-full truncate text-center text-[7px] font-semibold uppercase leading-none tracking-tight sm:text-[8px]',
                  current ? 'text-fg-primary' : reached ? 'text-fg-secondary' : 'text-fg-muted',
                )}
                title={t.label}
              >
                {t.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AccrualSparkline() {
  return (
    <div className="relative h-[148px] overflow-hidden rounded-xl border border-white/[0.06] bg-bg-sunken/90 shadow-inner ring-1 ring-white/[0.04]">
      <div className="absolute inset-0 bg-gradient-to-b from-accent-primary/[0.06] via-transparent to-violet-500/[0.05]" />
      <div className="absolute inset-0 grid grid-cols-8 opacity-[0.35]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-r border-border-subtle/80 last:border-r-0" />
        ))}
      </div>
      <div className="absolute inset-0 grid grid-rows-4 opacity-[0.35]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-b border-border-subtle/80 last:border-b-0" />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-[38%] h-px bg-gradient-to-r from-transparent via-accent-primary/70 to-transparent shadow-[0_0_16px_rgba(0,163,224,0.45)]" />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[42%] h-[42%] opacity-90"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, rgba(0,163,224,0.07) 55%, rgba(139,92,246,0.06) 100%)',
        }}
      />
      <div className="absolute bottom-2 left-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-glow/40 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-primary shadow-[0_0_10px_rgba(0,163,224,0.7)]" />
        </span>
        <p className="text-[10px] uppercase tracking-[0.14em] text-fg-muted">Points accrual index · live</p>
      </div>
    </div>
  );
}

export function PointsDashboard({ className }: { className?: string }) {
  const { getAccessToken, user, authenticated, ready, login } = usePointerAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseRewardsTab(searchParams.get('tab'));
  const leaderboardBoard = parseLeaderboardBoard(searchParams.get('board'));
  const campaignHighlight = parseCampaignHighlight(searchParams.get('campaign'));

  const setTab = (id: RewardsTab) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', id);
    router.replace(`/points?${next.toString()}`, { scroll: false });
  };

  const setLeaderboardBoard = (board: LeaderboardBoard) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', 'leaderboard');
    next.set('board', board);
    router.replace(`/points?${next.toString()}`, { scroll: false });
  };

  const setCampaignHighlight = (id: EcosystemCampaignId | null) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', 'rewards');
    if (id) next.set('campaign', id);
    else next.delete('campaign');
    router.replace(`/points?${next.toString()}`, { scroll: false });
  };

  const displayName = useMemo(() => displayNameFromUser(user), [user]);

  const [searchLb, setSearchLb] = useState('');
  const [lbPage, setLbPage] = useState(1);

  useEffect(() => {
    setLbPage(1);
  }, [searchLb]);

  useEffect(() => {
    if (tab !== 'rewards') return;
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#rewards-claim-hub') return;
    const id = window.setTimeout(() => {
      document.getElementById('rewards-claim-hub')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => window.clearTimeout(id);
  }, [tab]);

  const needsCampaignData = tab === 'rewards' || tab === 'leaderboard';

  const pointsQ = useQuery({
    queryKey: ['points-me'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      return authFetch<{
        totalPoints: number;
        breakdown: { event_type: string; total: number }[];
        rank: number | null;
      }>('/api/points/me', token);
    },
    enabled: ready && authenticated && needsCampaignData,
  });

  const refCodeQ = useQuery({
    queryKey: ['referral-code'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      return authFetch<{
        code: string;
        usesCount: number;
        referredCount: number;
        earnings: { paid: number; pending: number; total: number };
        feeShareBps: number;
      }>('/api/referrals/code', token);
    },
    enabled: ready && authenticated && needsCampaignData,
  });

  const earningsQ = useQuery({
    queryKey: ['referral-earnings'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      return authFetch<{
        sums: { paidSol: number; pendingSol: number; totalSol: number };
        recent: Array<{
          id: string;
          amountSol: number;
          paidOut: boolean;
          createdAt: string;
        }>;
      }>('/api/referrals/earnings?limit=25', token);
    },
    enabled: ready && authenticated && tab === 'rewards',
  });

  const lbQ = useQuery({
    queryKey: ['points-leaderboard', searchLb, lbPage],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const q = searchLb.trim() ? `&q=${encodeURIComponent(searchLb.trim())}` : '';
      return authFetch<LeaderboardPageResult>(
        `/api/points/leaderboard?page=${lbPage}&pageSize=50${q}`,
        token,
      );
    },
    staleTime: 20_000,
    enabled: ready && authenticated && tab === 'leaderboard',
  });

  const loadingRewards =
    tab === 'rewards' &&
    ready &&
    authenticated &&
    (pointsQ.isPending || refCodeQ.isPending || earningsQ.isPending || earningsQ.isFetching);

  const loadingLeaderboard =
    tab === 'leaderboard' &&
    ready &&
    authenticated &&
    (pointsQ.isPending || refCodeQ.isPending || lbQ.isPending || lbQ.isFetching);

  /** Only rewards / leaderboard tabs fetch heavy aggregates — referral & benefits render immediately. */
  const loading = loadingRewards || loadingLeaderboard;

  const shellClass = cn('flex min-h-0 flex-1 flex-col overflow-hidden text-[13px] text-fg-primary', className);

  const tabNav = (
    <div className="flex shrink-0 items-center gap-0.5 border-b border-border-subtle/90 bg-bg-base/95 px-1.5 py-1.5 backdrop-blur-md">
      {(
        [
          ['rewards', 'Rewards'],
          ['leaderboard', 'Leaderboard'],
          ['referral', 'Referral'],
          ['benefits', 'Benefits'],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setTab(id)}
          className={cn(
            'focus-ring relative rounded-lg px-3.5 pb-2 pt-1.5 text-[13px] tracking-tight transition-all duration-200',
            tab === id
              ? 'bg-bg-hover/80 font-semibold text-fg-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_24px_-8px_rgba(0,163,224,0.35)] ring-1 ring-cyan-500/20'
              : 'text-fg-muted hover:bg-bg-hover/50 hover:text-fg-secondary',
          )}
        >
          {label}
          {tab === id ? (
            <span className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-cyan-400/20 via-accent-primary to-violet-500/50 shadow-[0_0_14px_rgba(0,163,224,0.6)]" />
          ) : null}
        </button>
      ))}
    </div>
  );

  const refetchRewardsData = () => {
    void pointsQ.refetch();
    void refCodeQ.refetch();
    void earningsQ.refetch();
    void lbQ.refetch();
  };

  if (!ready) {
    return (
      <div className={shellClass}>
        {tabNav}
        <div className="flex min-h-[300px] flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-accent-primary" />
        </div>
      </div>
    );
  }

  if (!authenticated && needsCampaignData) {
    return (
      <div className={shellClass}>
        {tabNav}
        <div className="relative min-h-0 flex-1 overflow-auto">
          <HeroBackdrop />
          <div className="relative z-[1] p-4 sm:p-5 lg:p-6">
            <GlassPanel
              variant="primary"
              className="mx-auto max-w-lg p-6 text-center shadow-[inset_0_1px_0_rgb(var(--fg-primary-rgb)/0.06)] sm:p-8"
            >
              <span className="inline-flex rounded-full border border-accent-primary/35 bg-accent-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-accent-glow">
                Pointer Points
              </span>
              <h2 className="mt-4 text-[clamp(1.25rem,2.8vw,1.5rem)] font-semibold tracking-tight text-fg-primary">
                Sign in to view rewards &amp; rank
              </h2>
              <p className="mt-2 text-[12px] leading-relaxed text-fg-secondary">
                Connect your Pointer account — campaign scoring syncs once you authenticate.
              </p>
              <button
                type="button"
                onClick={() => void login()}
                className="focus-ring btn-press mt-6 rounded-xl bg-gradient-to-r from-accent-primary to-accent-glow px-6 py-2.5 text-[13px] font-semibold text-fg-inverse shadow-[0_12px_32px_-12px_rgb(var(--accent-primary-rgb)/0.9)] transition hover:brightness-110 active:scale-[0.99]"
              >
                Sign in
              </button>
            </GlassPanel>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={shellClass}>
        {tabNav}
        <div className="flex min-h-[300px] flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-accent-primary" />
        </div>
      </div>
    );
  }

  const points = pointsQ.data;
  const refCode = refCodeQ.data;
  const earnings = earningsQ.data;
  const lb = lbQ.data;

  const campaignHydrated =
    needsCampaignData && Boolean(points && refCode && (tab !== 'rewards' || earnings));

  if (needsCampaignData && !campaignHydrated) {
    const backendErr =
      pointsQ.error ??
      refCodeQ.error ??
      (tab === 'rewards' ? earningsQ.error : undefined);
    let detail =
      backendErr instanceof Error ? backendErr.message : 'Campaign services did not respond. Try again shortly.';
    if (/^no_token$/i.test(detail)) detail = 'Session expired — sign out and reconnect.';
    return (
      <div className={shellClass}>
        {tabNav}
        <div className="relative min-h-0 flex-1 overflow-auto p-4 sm:p-6">
          <GlassPanel variant="secondary" glow="cyan" className="border border-signal-bear/25 bg-bg-raised p-6 sm:p-7">
            <p className="text-[13px] font-semibold text-signal-bear">Couldn&apos;t load campaign data</p>
            <p className="mt-2 text-[12px] leading-relaxed text-fg-secondary">
              {detail.length > 220 ? `${detail.slice(0, 220)}…` : detail}
            </p>
            <button
              type="button"
              onClick={() => refetchRewardsData()}
              className="focus-ring btn-press mt-5 rounded-xl border border-border-subtle bg-bg-hover px-4 py-2.5 text-[12px] font-semibold text-fg-primary transition hover:border-accent-primary/35"
            >
              Retry
            </button>
          </GlassPanel>
        </div>
      </div>
    );
  }

  const rankState = rankTierFromPoints(points?.totalPoints ?? 0);
  const referralRatePct = refCode ? Math.round(refCode.feeShareBps / 100) : 0;
  const you = lb?.you;

  if (tab === 'leaderboard' && leaderboardBoard === 'traders' && !lb) {
    return (
      <div className={shellClass}>
        {tabNav}
        <div className="flex min-h-[300px] flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-accent-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      {tabNav}

      {tab === 'rewards' && points && refCode && earnings ? (
        <div className="relative min-h-0 flex-1 overflow-auto">
          <HeroBackdrop />

          <div className="relative space-y-6 p-4 sm:p-5 lg:p-6">
            {/* Hero */}
            <GlassPanel variant="hero" glow="cyan" className="p-5 sm:p-6 lg:p-7">
              <div className="grid gap-8 lg:grid-cols-3 lg:items-start lg:gap-6 xl:gap-8">
                <div className="min-w-0 space-y-4 lg:max-w-none">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-bg-sunken/90 px-3 py-1.5 text-[11px] text-fg-secondary shadow-inner ring-1 ring-cyan-500/15">
                    <Radio className="h-3.5 w-3.5 text-accent-glow" aria-hidden />
                    <span className="tabular-nums font-medium text-fg-primary">{POINTS_SEASON_LABEL}</span>
                    <span className="text-fg-muted">·</span>
                    <span>
                      Rules v{POINTS_RULES_VERSION}
                    </span>
                    <span className="rounded-md bg-accent-primary/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-accent-glow">
                      Live
                    </span>
                  </div>
                  <h1 className="font-semibold tracking-tight text-fg-primary text-[clamp(1.45rem,3.2vw,1.95rem)] leading-[1.15]">
                    Pointer Points
                  </h1>
                  <p className="text-[12px] leading-relaxed text-fg-secondary">
                    Transparent campaign scoring for real terminal usage — trading, referrals, retention, and verified
                    identity. Social accounts unlock credibility and creator flows; they do not mint points for posts or
                    replies.
                  </p>
                  <div className="flex flex-col gap-3 pt-1">
                    <p className="max-w-xl rounded-xl border border-white/[0.08] bg-bg-sunken/50 px-4 py-3 text-[11px] leading-relaxed text-fg-secondary ring-1 ring-cyan-500/10">
                      <span className="font-semibold text-accent-glow">Rewards checkpoint</span> lives in the center
                      column — claim referral SOL, redeemable Points, and cashback inline with rank progress and live
                      referral timing.
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => setTab('referral')}
                      className="focus-ring btn-press inline-flex items-center gap-2 rounded-lg border border-cyan-500/35 bg-bg-hover px-3.5 py-2.5 text-[12px] font-semibold text-fg-primary shadow-[0_0_28px_-10px_rgba(0,163,224,0.55)] transition hover:border-cyan-400/45 hover:shadow-[0_0_36px_-8px_rgba(0,163,224,0.65)]"
                    >
                      Referral program
                      <ArrowRight className="h-3.5 w-3.5 opacity-80" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const share = buildReferralInviteUrl(refCode.code);
                        void navigator.clipboard.writeText(share);
                        toast.success('Referral link copied');
                      }}
                      className="focus-ring btn-press inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3.5 py-2.5 text-[12px] font-medium text-fg-secondary transition hover:border-violet-400/35 hover:bg-bg-hover/80 hover:text-fg-primary"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Copy invite link
                    </button>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 lg:min-h-[320px]">
                  <RewardsClaimHub
                    rankTierLabel={rankState.tier.label}
                    nextTierLabel={rankState.next?.label ?? null}
                    rankProgress01={rankState.progressToNext}
                    lifetimePointsDisplay={points.totalPoints}
                    referralRecent={earnings.recent.slice(0, 12)}
                    referralPendingSol={earnings.sums.pendingSol}
                    referralPaidSol={earnings.sums.paidSol}
                  />
                </div>

                <div className="relative w-full min-w-0 lg:max-w-none">
                  <div className="absolute -left-8 -top-8 hidden h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.18)_0%,transparent_70%)] blur-2xl lg:block" />
                  <div className="relative flex flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-b from-bg-hover/55 to-bg-base/75 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_48px_-28px_rgba(0,0,0,0.85)] ring-1 ring-cyan-400/20 backdrop-blur-md">
                    <div className="flex items-start gap-4">
                      <RankSeal label={rankState.tier.label} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fg-muted">
                              Operator status
                            </p>
                            <p className="truncate text-[16px] font-semibold tracking-tight text-fg-primary">
                              {displayName}
                            </p>
                          </div>
                          <div className="rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-right shadow-[0_0_24px_-12px_rgba(167,139,250,0.55)] ring-1 ring-violet-400/20">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200/90">
                              Rank
                            </p>
                            <p className="text-[18px] font-bold leading-none tracking-tight text-fg-primary">
                              {rankState.tier.label}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-4">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
                              Total points
                            </p>
                            <p className="mt-1 flex items-center gap-2 text-[22px] font-semibold tabular-nums tracking-tight text-fg-primary">
                              <PointerBirdMark
                                size={24}
                                className="opacity-95 drop-shadow-[0_0_12px_rgb(var(--accent-primary-rgb)/0.45)]"
                              />
                              {formatNumber(points.totalPoints)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
                              Referral rate
                            </p>
                            <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-fg-primary">
                              {referralRatePct}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <RankMiniLadder currentId={rankState.tier.id} />

                    {rankState.next ? (
                      <div className="border-t border-white/[0.06] pt-4">
                        <div className="mb-2 flex justify-between text-[11px] text-fg-muted">
                          <span className="font-medium text-fg-secondary">
                            Ascension to <span className="text-fg-primary">{rankState.next.label}</span>
                          </span>
                          <span className="tabular-nums font-semibold text-accent-glow">
                            {Math.round(rankState.progressToNext * 100)}%
                          </span>
                        </div>
                        <div className="relative h-2.5 overflow-hidden rounded-full bg-bg-base ring-1 ring-white/[0.06]">
                          <div
                            className="points-progress-fill h-full rounded-full transition-[width] duration-700 ease-out"
                            style={{ width: `${Math.round(rankState.progressToNext * 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="border-t border-white/[0.06] pt-4 text-[11px] text-fg-muted">
                        Apex tier displayed for this ladder preview — disclosure continues with seasonal rules.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </GlassPanel>

            {/* Eligibility & transparency — primary campaign governance */}
            <GlassPanel variant="primary" className="p-5 sm:p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-12">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-200/90">
                      Eligibility · Transparency
                    </h2>
                    <span className="rounded-full border border-white/10 bg-bg-base/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-fg-muted ring-1 ring-violet-400/15">
                      Rules log · v{POINTS_RULES_VERSION}
                    </span>
                  </div>
                  <p className="max-w-xl text-[12px] leading-relaxed text-fg-secondary">
                    Season rules, breakdowns, pool disclosures, and eligibility gates publish here as campaigns mature.
                    Last reviewed{' '}
                    <span className="tabular-nums font-medium text-fg-primary">{POINTS_LAST_UPDATED_LABEL}</span>.
                  </p>
                </div>
                <ul className="max-w-md space-y-3 text-[11px] leading-snug text-fg-secondary">
                  {TRANSPARENCY_BULLETS.map((line) => (
                    <li key={line} className="flex gap-2.5 rounded-lg border border-white/[0.04] bg-bg-base/40 px-3 py-2 ring-1 ring-white/[0.03]">
                      <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300/90" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </GlassPanel>

            {/* Ecosystem campaigns */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-fg-muted">
                    Active ecosystem nodes
                  </h2>
                  <p className="mt-1 text-[11px] text-fg-muted">
                    Select a surface to filter campaign context — scoring stays on-terminal.
                  </p>
                </div>
                {campaignHighlight ? (
                  <button
                    type="button"
                    onClick={() => setCampaignHighlight(null)}
                    className="text-[11px] font-medium text-accent-glow underline-offset-4 transition hover:text-fg-primary hover:underline"
                  >
                    Clear filter
                  </button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {ECOSYSTEM_CAMPAIGNS.map((c) => {
                  const active = campaignHighlight === c.id;
                  const vis = ECOSYSTEM_NODE_VISUAL[c.id];
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCampaignHighlight(active ? null : c.id)}
                      className={cn(
                        'points-eco-hover focus-ring relative overflow-hidden rounded-2xl border p-3.5 text-left',
                        active
                          ? 'border-cyan-400/50 bg-bg-hover/40 shadow-[0_0_40px_-14px_rgba(0,163,224,0.55)] ring-2 ring-cyan-400/25'
                          : 'border-border-subtle/90 bg-bg-base/50 ring-1 ring-white/[0.04]',
                      )}
                    >
                      <div
                        className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full blur-2xl"
                        style={{ background: `radial-gradient(circle, ${vis.radial} 0%, transparent 70%)` }}
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                      <div className="relative mb-2 flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <ChainGlyph
                            chain={c.id}
                            className="h-8 w-8 shrink-0 opacity-[0.92] drop-shadow-[0_0_14px_rgba(255,255,255,0.06)]"
                            title={c.label}
                          />
                          <p className="truncate text-[14px] font-semibold tracking-tight text-fg-primary">{c.label}</p>
                        </div>
                        <span
                          className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-bg-base/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-fg-secondary ring-1 ring-white/[0.06]"
                          style={{ borderColor: `${vis.accent}` }}
                        >
                          <span
                            className="points-live-dot h-1.5 w-1.5 rounded-full"
                            style={{ color: vis.liveHue, backgroundColor: vis.liveHue }}
                          />
                          {vis.status}
                        </span>
                      </div>
                      {vis.boost ? (
                        <span className="relative mb-2 inline-flex rounded-md border border-cyan-400/25 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-100/95 ring-1 ring-cyan-400/20">
                          {vis.boost}
                        </span>
                      ) : null}
                      <p className="relative text-[11px] leading-snug text-fg-secondary">{c.tagline}</p>
                      <div className="relative mt-3 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-2.5">
                        <span className="text-[9px] font-medium uppercase tracking-wider text-fg-muted">
                          {vis.meta}
                        </span>
                        <span className="rounded-md border border-white/10 bg-bg-sunken/80 px-1.5 py-px text-[9px] tabular-nums text-fg-muted ring-1 ring-white/[0.04]">
                          S1
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {campaignHighlight ? (
                <p className="text-[11px] text-fg-muted">
                  Filtering <span className="font-semibold text-accent-glow">{campaignHighlight}</span> — scoring stays
                  tied to on-terminal behaviour and disclosed partner routes, not social posting.
                </p>
              ) : null}
            </div>

            <CampaignRadarSection selected={campaignHighlight} />

            {/* Pillars */}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <GlassPanel
                variant="secondary"
                className="group p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/12 hover:shadow-[0_12px_40px_-28px_rgba(0,0,0,0.75)]"
              >
                <div className="mb-2 inline-flex rounded-lg border border-border-subtle bg-bg-sunken/60 p-2 ring-1 ring-white/[0.03] transition group-hover:border-accent-primary/30">
                  <Zap className="h-4 w-4 text-accent-primary" aria-hidden />
                </div>
                <h3 className="text-[13px] font-semibold">Trading points</h3>
                <p className="mt-1.5 text-[11px] leading-relaxed text-fg-secondary">
                  Volume, trade count, streaks, multi-chain routes, trackers, alerts, co-pilot and portfolio usage —
                  scored as product-native activity.
                </p>
              </GlassPanel>
              <GlassPanel
                variant="secondary"
                className="group p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/12 hover:shadow-[0_12px_40px_-28px_rgba(0,0,0,0.75)]"
              >
                <div className="mb-2 inline-flex rounded-lg border border-border-subtle bg-bg-sunken/60 p-2 ring-1 ring-white/[0.03] transition group-hover:border-signal-bull/25">
                  <Users className="h-4 w-4 text-signal-bull" aria-hidden />
                </div>
                <h3 className="text-[13px] font-semibold">Referral points</h3>
                <p className="mt-1.5 text-[11px] leading-relaxed text-fg-secondary">
                  Invites that convert to active traders, retained usage, and referred volume — partner codes supported
                  where configured.
                </p>
              </GlassPanel>
              <GlassPanel
                variant="secondary"
                className="group p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/12 hover:shadow-[0_12px_40px_-28px_rgba(0,0,0,0.75)]"
              >
                <div className="mb-2 inline-flex rounded-lg border border-border-subtle bg-bg-sunken/60 p-2 ring-1 ring-white/[0.03] transition group-hover:border-signal-info/25">
                  <Shield className="h-4 w-4 text-signal-info" aria-hidden />
                </div>
                <h3 className="text-[13px] font-semibold">Social identity</h3>
                <p className="mt-1.5 text-[11px] leading-relaxed text-fg-secondary">{SOCIAL_IDENTITY_COPY}</p>
              </GlassPanel>
              <GlassPanel
                variant="secondary"
                className="group p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/12 hover:shadow-[0_12px_40px_-28px_rgba(0,0,0,0.75)]"
              >
                <div className="mb-2 inline-flex rounded-lg border border-border-subtle bg-bg-sunken/60 p-2 ring-1 ring-white/[0.03] transition group-hover:border-violet-400/25">
                  <Compass className="h-4 w-4 text-[#a78bfa]" aria-hidden />
                </div>
                <h3 className="text-[13px] font-semibold">Creator / operator</h3>
                <p className="mt-1.5 text-[11px] leading-relaxed text-fg-secondary">{CREATOR_PROGRAM_COPY}</p>
              </GlassPanel>
            </div>

            {/* Breakdown + charts */}
            <div className="grid gap-4 lg:grid-cols-3">
              <GlassPanel variant="quiet" glow="cyan" className="p-4 lg:col-span-2">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] pb-3">
                  <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-fg-muted">Points breakdown</h3>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-100/90 ring-1 ring-cyan-400/15">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-glow/35 opacity-60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-primary" />
                    </span>
                    Ledger live
                  </span>
                </div>
                <div className="max-h-[220px] overflow-auto rounded-xl border border-white/[0.05] bg-bg-base/40 ring-1 ring-white/[0.03]">
                  <table className="w-full border-collapse text-left text-[12px]">
                    <thead className="sticky top-0 z-[1] bg-bg-raised/95 backdrop-blur">
                      <tr className="border-b border-border-subtle">
                        <th className="px-3 py-2 font-medium text-fg-muted">Source</th>
                        <th className="px-3 py-2 text-right font-medium text-fg-muted">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {points.breakdown.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="px-3 py-8 text-center text-fg-muted">
                            No scored events yet — trade and use the terminal to accrue.
                          </td>
                        </tr>
                      ) : (
                        points.breakdown.map((row) => (
                          <tr key={row.event_type} className="border-b border-border-subtle/80 last:border-0">
                            <td className="px-3 py-2 text-[11px] text-fg-secondary">{row.event_type}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-fg-primary">{formatNumber(row.total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassPanel>

              <GlassPanel variant="secondary" className="flex flex-col p-4 ring-1 ring-violet-400/10">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-fg-muted">Accrual visual</h3>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-violet-200/70">Synthetic</span>
                </div>
                <AccrualSparkline />
                <p className="mt-3 text-[11px] leading-relaxed text-fg-muted">
                  Illustrative series — full historical curves ship with analytics rollout.
                </p>
              </GlassPanel>
            </div>

            <GlassPanel variant="quiet" className="p-4 lg:col-span-3">
              <h3 className="mb-1 text-[12px] font-bold uppercase tracking-[0.12em] text-fg-muted">Settlement</h3>
              <p className="mb-4 text-[11px] leading-relaxed text-fg-secondary">
                Claims and reward pools follow seasonal disclosure. Live referral timing streams in the Rewards
                checkpoint card above — no duplicate ledger table here.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-white/[0.06] bg-bg-base/50 px-3 py-2.5 text-center ring-1 ring-white/[0.03]">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Pending SOL</p>
                  <p className="text-[15px] font-semibold tabular-nums text-accent-glow">
                    {formatNumber(earnings.sums.pendingSol, { decimals: 4 })}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-bg-base/50 px-3 py-2.5 text-center ring-1 ring-white/[0.03]">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Paid SOL</p>
                  <p className="text-[15px] font-semibold tabular-nums text-fg-primary">
                    {formatNumber(earnings.sums.paidSol, { decimals: 4 })}
                  </p>
                </div>
                <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.07] px-3 py-2.5 text-center ring-1 ring-cyan-400/15">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Season</p>
                  <p className="text-[13px] font-semibold text-fg-primary">
                    {POINTS_SEASON_LABEL.split('—')[0]?.trim() ?? 'S1'}
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-bg-sunken/60 px-3 py-2.5 ring-1 ring-white/[0.04]">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Attribution</p>
                  <p className="mt-1 text-[11px] tabular-nums text-fg-secondary">
                    Codes <span className="font-semibold text-fg-primary">{refCode.usesCount}</span>
                    <span className="mx-1 text-fg-muted">·</span>
                    Referred <span className="font-semibold text-fg-primary">{refCode.referredCount}</span>
                  </p>
                </div>
              </div>
              <Link
                href="#rewards-claim-hub"
                className="focus-ring btn-press mt-4 flex w-full items-center justify-center rounded-xl border border-cyan-400/35 bg-cyan-500/10 py-2.5 text-[12px] font-semibold text-cyan-50 ring-1 ring-cyan-400/22 transition hover:bg-cyan-500/15"
              >
                Jump to Rewards checkpoint
              </Link>
            </GlassPanel>
          </div>
        </div>
      ) : null}

      {tab === 'referral' ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <Suspense
            fallback={
              <div className="flex min-h-[300px] items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-accent-primary" />
              </div>
            }
          >
            <ReferralDashboard className="min-h-0 flex-1" />
          </Suspense>
        </div>
      ) : null}

      {tab === 'leaderboard' && points && refCode && lb ? (
        <div className="relative min-h-0 flex-1 overflow-auto">
          <HeroBackdrop />
          <div className="relative space-y-6 p-4 sm:p-5 lg:p-6">
            <GlassPanel variant="hero" glow="violet" className="p-6 sm:p-8">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-100/90 shadow-[0_0_28px_-12px_rgba(167,139,250,0.55)] ring-1 ring-violet-400/25">
                  <Trophy className="h-4 w-4 text-violet-200" />
                  <span className="text-fg-secondary">Leaderboard</span>
                  <span className="h-1 w-1 rounded-full bg-violet-300 shadow-[0_0_8px_rgba(167,139,250,0.9)]" />
                  <span className="normal-case tracking-normal text-fg-muted">{POINTS_SEASON_LABEL}</span>
                </div>
                <div className="mb-3 flex items-center justify-center gap-3">
                  <RankSeal label={rankState.tier.label} />
                  <div className="text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-muted">Operator</p>
                    <p className="text-[13px] font-semibold text-fg-primary">{displayName}</p>
                  </div>
                </div>
                <p className="bg-gradient-to-br from-white via-fg-primary to-fg-secondary bg-clip-text text-[clamp(1.65rem,4.5vw,2.35rem)] font-bold tabular-nums tracking-tight text-transparent drop-shadow-[0_0_28px_rgba(167,139,250,0.25)]">
                  {formatNumber(points.totalPoints)}
                </p>
                <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-bg-base/50 px-4 py-2 text-[12px] shadow-inner ring-1 ring-white/[0.06]">
                  <span className="text-fg-muted">Season rank</span>
                  <span className="font-bold tabular-nums text-accent-glow drop-shadow-[0_0_12px_rgba(0,163,224,0.45)]">
                    #{you?.rank ?? points.rank ?? '—'}
                  </span>
                  <span className="text-fg-muted">·</span>
                  <span className="font-semibold text-violet-200/95">{rankState.tier.label}</span>
                </div>
              </div>
            </GlassPanel>

            <div className="flex flex-wrap gap-2.5">
              {(
                [
                  ['traders', 'Traders', Trophy],
                  ['referrers', 'Referrers', Users],
                  ['creators', 'Creators', Activity],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setLeaderboardBoard(id)}
                  className={cn(
                    'focus-ring btn-press inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[12px] font-medium transition-all duration-200',
                    leaderboardBoard === id
                      ? 'border-cyan-400/45 bg-bg-hover text-fg-primary shadow-[0_0_28px_-10px_rgba(0,163,224,0.55)] ring-2 ring-cyan-400/25'
                      : 'border-border-subtle/90 text-fg-muted hover:border-violet-400/35 hover:bg-bg-hover/60 hover:text-fg-secondary',
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', leaderboardBoard === id ? 'text-accent-glow' : 'opacity-75')} />
                  {label}
                </button>
              ))}
            </div>

            {leaderboardBoard === 'traders' ? (
              <GlassPanel variant="secondary" className="overflow-hidden shadow-[0_20px_60px_-40px_rgba(0,0,0,0.9)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-bg-base/30 px-4 py-3 backdrop-blur-sm">
                  <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-fg-muted">Trader standings</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-bg-sunken/70 px-2.5 py-1.5 ring-1 ring-white/[0.04]">
                      <Search className="h-3.5 w-3.5 text-fg-muted" />
                      <input
                        value={searchLb}
                        onChange={(e) => setSearchLb(e.target.value)}
                        placeholder="Search username or wallet"
                        className="w-40 border-0 bg-transparent text-[12px] text-fg-primary outline-none placeholder:text-fg-muted sm:w-48"
                      />
                    </div>
                    <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-bg-base/40 p-0.5 ring-1 ring-white/[0.04]">
                      <button
                        type="button"
                        disabled={lbPage <= 1}
                        onClick={() => setLbPage((p) => Math.max(1, p - 1))}
                        className="focus-ring rounded-lg border border-transparent p-1.5 text-fg-muted transition hover:border-cyan-400/25 hover:bg-bg-hover hover:text-accent-glow disabled:opacity-35"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="min-w-[3.25rem] text-center tabular-nums text-[11px] font-semibold text-fg-secondary">
                        {lbPage} / {Math.max(1, lb.tablePages)}
                      </span>
                      <button
                        type="button"
                        disabled={lbPage >= lb.tablePages}
                        onClick={() => setLbPage((p) => p + 1)}
                        className="focus-ring rounded-lg border border-transparent p-1.5 text-fg-muted transition hover:border-cyan-400/25 hover:bg-bg-hover hover:text-accent-glow disabled:opacity-35"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="max-h-[min(56vh,520px)] overflow-auto">
                  <table className="w-full border-collapse text-left text-[12px]">
                    <thead className="sticky top-0 z-[1] bg-bg-raised/95 backdrop-blur">
                      <tr className="border-b border-border-subtle">
                        <th className="px-3 py-2 font-medium text-fg-muted">Rank</th>
                        <th className="px-3 py-2 font-medium text-fg-muted">Operator</th>
                        <th className="px-3 py-2 text-right font-medium text-fg-muted">Points</th>
                        <th className="px-3 py-2 text-right font-medium text-fg-muted">Active days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lb.rows.map((r, i) => (
                        <tr
                          key={r.user_id}
                          className={cn(
                            'border-b border-border-subtle/80 transition hover:bg-bg-hover/40',
                            i % 2 === 0 ? 'bg-bg-base/30' : '',
                          )}
                        >
                          <td className="px-3 py-2.5 tabular-nums text-fg-secondary">{r.rank}</td>
                          <td className="px-3 py-2.5 text-fg-primary">
                            {r.username ?? shortenAddress(r.wallet_address ?? r.user_id, 4)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="rounded-md border border-border-subtle bg-bg-sunken/50 px-2 py-0.5 tabular-nums font-medium">
                              {formatNumber(r.total_points)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-fg-secondary">{r.active_days}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-white/[0.06] bg-bg-base/25 px-4 py-2.5 text-[11px] text-fg-muted">
                  Showing {lb.rows.length} of {lb.tableTotal} · anti-sybil weighting applies off-chain
                </div>
              </GlassPanel>
            ) : (
              <GlassPanel variant="secondary" glow="violet" className="p-10 text-center ring-1 ring-violet-400/15">
                <p className="text-[15px] font-semibold tracking-tight text-fg-primary">
                  {leaderboardBoard === 'referrers' ? 'Referrer standings' : 'Creator standings'}
                </p>
                <p className="mx-auto mt-3 max-w-md text-[12px] leading-relaxed text-fg-secondary">
                  {leaderboardBoard === 'referrers'
                    ? 'A dedicated referrer ladder with acquisition quality metrics is shipping — volume-weighted invites and retention, not vanity followers.'
                    : 'Creator and operator boards are curated — application-only, attribution via referral links and disclosed volume impact.'}
                </p>
              </GlassPanel>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'benefits' ? (
        <div className="relative min-h-0 flex-1 overflow-auto">
          <HeroBackdrop />
          <div className="relative z-[1] space-y-6 p-4 sm:p-5 lg:p-6">
            <GlassPanel variant="primary" className="p-5 sm:p-6">
              <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-violet-100/90">Benefits</h2>
              <p className="mt-3 max-w-3xl text-[12px] leading-relaxed text-fg-secondary">
                Pointer Points tracks usage across connected ecosystems — Solana, TON, Base, BNB, Hyperliquid — as
                campaigns go live. Perks follow integrations and seasonal disclosure; nothing here pays you for spamming
                timelines.
              </p>
            </GlassPanel>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <BenefitCard
              title="Pointer Points"
              description="Earn from trading volume, retention, referrals, and verified identity — transparent seasonal rules."
              accent="var(--accent-primary)"
              button="Open rewards"
              href="/points?tab=rewards"
            />
            <BenefitCard
              title="Leaderboards"
              description="Separate prestige rails for traders, referrers, and creators — credibility without engagement farming."
              accent="#a78bfa"
              button="View leaderboard"
              href="/points?tab=leaderboard"
            />
            <BenefitCard
              title="Referrals"
              description="Share your code and earn when invited operators trade — quality-weighted where configured."
              accent="var(--signal-bull)"
              button="Referral desk"
              href="/points?tab=referral"
            />
            <BenefitCard
              title="DEX & routing activity"
              description="Volume through Pulse and routed venues counts toward trading signals. Third-party protocol claims appear when integrations ship."
              accent="var(--signal-info)"
              button="Trade"
              href="/"
            />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BenefitCard({
  title,
  description,
  accent,
  button,
  href,
}: {
  title: string;
  description: string;
  accent: string;
  button: string;
  href?: string;
}) {
  const ctaClass =
    'mt-3 inline-flex w-full justify-center rounded-lg px-3 py-2 text-[12px] font-semibold text-fg-inverse transition hover:brightness-110';
  const cta = href ? (
    <Link href={href} className={ctaClass} style={{ backgroundColor: accent }}>
      {button}
    </Link>
  ) : (
    <button type="button" disabled className={cn(ctaClass, 'cursor-not-allowed opacity-50 hover:brightness-100')}>
      {button}
    </button>
  );
  return (
    <GlassPanel
      variant="secondary"
      className="group flex min-h-[200px] flex-col p-4 transition duration-300 hover:-translate-y-0.5 hover:border-white/12 hover:shadow-[0_16px_48px_-32px_rgba(0,0,0,0.85)]"
    >
      <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
        <span
          className="h-2 w-2 rounded-full shadow-[0_0_14px_currentColor] transition group-hover:scale-110"
          style={{ backgroundColor: accent }}
        />
        {title}
      </div>
      <p className="flex-1 text-[12px] leading-relaxed text-fg-secondary">{description}</p>
      {cta}
    </GlassPanel>
  );
}
