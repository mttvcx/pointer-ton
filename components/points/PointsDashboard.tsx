'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Medal, Search, Share2, Sparkles, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { formatNumber, formatRelativeTime } from '@/lib/utils/formatters';
import type { LeaderboardPageResult } from '@/lib/points/leaderboardTypes';

const BORDER = '#1b1f2a';
const BG = '#080d14';
const PANEL = '#121622';
const PANEL2 = '#151826';

type RewardsTab = 'rewards' | 'leaderboard' | 'benefits';

function shortenAddress(value: string, chars = 4) {
  if (!value) return '';
  if (value.length <= chars * 2 + 1) return value;
  return `${value.slice(0, chars)}...${value.slice(-chars)}`;
}

async function authFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `request_${res.status}`);
  }
  return res.json() as Promise<T>;
}

function TinyLineChart() {
  return (
    <div className="relative h-[160px] overflow-hidden rounded border" style={{ borderColor: BORDER, backgroundColor: BG }}>
      <div className="absolute inset-0 grid grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-r last:border-r-0" style={{ borderColor: BORDER }} />
        ))}
      </div>
      <div className="absolute inset-0 grid grid-rows-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-b last:border-b-0" style={{ borderColor: BORDER }} />
        ))}
      </div>
      <div className="absolute left-0 right-0 top-[58%] h-px bg-[#5865F2]" />
    </div>
  );
}

function CircleQuest({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className="relative h-16 w-16 rounded-full border" style={{ borderColor: BORDER }}>
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" stroke="#1f2533" strokeWidth="8" fill="none" />
          <circle
            cx="50"
            cy="50"
            r="42"
            stroke={color}
            strokeWidth="8"
            fill="none"
            strokeDasharray={`${pct * 2.64} 999`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[10px] tabular-nums text-[#d1d5db]">
          {formatNumber(value, { compact: true, decimals: 0 })}
        </div>
      </div>
      <p className="max-w-[90px] text-[10px] leading-tight text-[#9ca3af]">{label}</p>
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
    'mt-2 inline-flex w-full justify-center rounded-full px-2 py-1 text-[10px] font-semibold text-[#0a0a0f] transition hover:brightness-110';
  const cta = href ? (
    <Link href={href} className={ctaClass} style={{ backgroundColor: accent }}>
      {button}
    </Link>
  ) : (
    <button
      type="button"
      disabled
      className={cn(ctaClass, 'cursor-not-allowed opacity-50 hover:brightness-100')}
      style={{ backgroundColor: accent }}
    >
      {button}
    </button>
  );
  return (
    <article className="flex min-h-[180px] flex-col rounded border p-2" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-white">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
        {title}
      </div>
      <p className="flex-1 text-[10px] leading-snug text-[#6b7280]">{description}</p>
      {cta}
    </article>
  );
}

export function PointsDashboard({ className, initialTab = 'rewards' }: { className?: string; initialTab?: RewardsTab }) {
  const { getAccessToken } = usePointerAuth();
  const [tab, setTab] = useState<RewardsTab>(initialTab);
  const [searchLb, setSearchLb] = useState('');

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
  });

  const lbQ = useQuery({
    queryKey: ['points-leaderboard', searchLb],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const q = searchLb.trim() ? `&q=${encodeURIComponent(searchLb.trim())}` : '';
      return authFetch<LeaderboardPageResult>(`/api/points/leaderboard?page=1&pageSize=50${q}`, token);
    },
    staleTime: 20_000,
  });

  const loading = pointsQ.isLoading || refCodeQ.isLoading || earningsQ.isLoading || lbQ.isLoading;
  if (loading) {
    return (
      <div className={cn('flex h-full min-h-[300px] items-center justify-center', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-[#5865F2]" />
      </div>
    );
  }

  const points = pointsQ.data;
  const refCode = refCodeQ.data;
  const earnings = earningsQ.data;
  const lb = lbQ.data;
  if (!points || !refCode || !earnings || !lb) {
    return (
      <div className={cn('rounded border p-3 text-[12px] text-[#f87171]', className)} style={{ borderColor: BORDER, backgroundColor: PANEL }}>
        Could not load rewards data.
      </div>
    );
  }

  const username = 'Moustapha';
  const tier = points.totalPoints > 5_000_000 ? 'Diamond' : points.totalPoints > 1_000_000 ? 'Gold' : 'Silver';
  const mult = tier === 'Diamond' ? '4X Rewards' : tier === 'Gold' ? '2X Rewards' : '1X Rewards';
  const nextTierLabel = tier === 'Diamond' ? 'Champion' : tier === 'Gold' ? 'Diamond' : 'Gold';
  const progressPct = tier === 'Diamond' ? 82 : tier === 'Gold' ? 54 : 26;
  const you = lb.you;

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden text-[12px] text-white', className)}>
      {/* sub-nav */}
      <div className="flex shrink-0 items-center gap-3 border-b px-2 py-1" style={{ borderColor: BORDER, backgroundColor: BG }}>
        {([
          ['rewards', 'Rewards'],
          ['leaderboard', 'Leaderboard'],
          ['benefits', 'Benefits'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'relative pb-1 text-[13px] transition',
              tab === id ? 'font-semibold text-white' : 'text-[#6b7280] hover:text-[#d1d5db]',
            )}
          >
            {label}
            {tab === id ? <span className="absolute inset-x-0 -bottom-[1px] h-[2px] rounded-full bg-[#5865F2]" /> : null}
          </button>
        ))}
      </div>

      {tab === 'rewards' ? (
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {/* profile header */}
          <section className="rounded border p-3" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
            <div className="relative flex flex-wrap items-start justify-between gap-2">
              <div className="w-[96px]" />
              <div className="mx-auto flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-md border p-1" style={{ borderColor: '#6ea7ff', backgroundColor: '#20263a' }}>
                  <div className="h-full w-full rounded bg-[#f3b34c]" />
                </div>
                <p className="mt-1 text-[11px] text-[#d1d5db]">{username}</p>
                <p className="text-[20px] font-semibold leading-tight text-white">{mult}</p>
                <p className="text-[11px] text-[#9ca3af]">{Math.round(refCode.feeShareBps / 100)}% Referral Rate ? {tier}</p>
                <div className="mt-1.5 flex items-center gap-3 text-[12px]">
                  <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-[#a78bfa]" /> {formatNumber(points.totalPoints)}</span>
                  <span className="inline-flex items-center gap-1 text-[#9ca3af]"><Trophy className="h-3.5 w-3.5" /> {formatNumber(refCode.earnings.total, { compact: true, decimals: 2 })} Earned</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button className="rounded border px-2 py-1 text-[10px] font-semibold text-[#d1d5db]" style={{ borderColor: BORDER }}>
                  Edit Referral
                </button>
                <button
                  onClick={() => {
                    const share = `${window.location.origin}/referral?code=${encodeURIComponent(refCode.code)}`;
                    void navigator.clipboard.writeText(share);
                    toast.success('Referral link copied');
                  }}
                  className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-semibold text-[#d1d5db]"
                  style={{ borderColor: BORDER }}
                >
                  <Share2 className="h-3.5 w-3.5" /> Share Referral
                </button>
              </div>
            </div>

            <div className="mt-2.5 border-t pt-2" style={{ borderColor: BORDER }}>
              <div className="mb-1 flex items-center justify-between text-[10px] text-[#6b7280]">
                <span>Next Level: {nextTierLabel} Rewards rate</span>
                <span>You&apos;re almost there! Trade 1.7K TON to reach Champion</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#080d14]">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#5865F2,#8b5cf6)] shadow-[0_0_10px_rgba(88,101,242,0.45)]" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </section>

          {/* claim grid */}
          <section className="mt-2 grid gap-2 lg:grid-cols-3">
            <article className="rounded border p-2" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
              <div className="mb-2 text-[11px] font-semibold text-white">TON Rewards</div>
              <TinyLineChart />
            </article>

            <article className="rounded border p-2" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
              <div className="mb-2 text-[11px] font-semibold text-white">Claim</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-full border px-2 py-1 text-center text-[16px] font-semibold" style={{ borderColor: BORDER }}>? +0</div>
                <div className="rounded-full border px-2 py-1 text-center text-[16px] font-semibold" style={{ borderColor: BORDER }}>? +0</div>
                <div className="col-span-2 rounded-full border px-2 py-1 text-center text-[16px] font-semibold" style={{ borderColor: BORDER }}>? +0</div>
              </div>
              <button className="mt-2 w-full rounded-full bg-[#5865F2] py-2 text-[11px] font-semibold text-[#0a0a0f]">Nothing to Claim</button>
            </article>

            <article className="rounded border p-2" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-white">Quests</span>
                <span className="text-[10px] text-[#6b7280]">Points Breakdown</span>
              </div>
              <div className="flex items-start justify-around gap-1">
                <CircleQuest value={refCode.referredCount} max={3} label="Refer 3 more people" color="#4ade80" />
                <CircleQuest value={refCode.earnings.total} max={1_000_000} label="Trade 6000 more TON in Volume" color="#5865F2" />
                <CircleQuest value={(lb.rows?.length ?? 0) * 1000} max={100_000} label="Make 5000 more transactions" color="#f472b6" />
              </div>
            </article>
          </section>

          {/* activity */}
          <section className="mt-2 rounded border" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
            <div className="border-b px-2 py-1 text-[11px] font-semibold" style={{ borderColor: BORDER }}>Activity</div>
            <div className="max-h-56 overflow-auto">
              {earnings.recent.length === 0 ? (
                <div className="px-2 py-10 text-center text-[11px] text-[#6b7280]">No referral activity yet</div>
              ) : (
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead className="sticky top-0" style={{ backgroundColor: PANEL2 }}>
                    <tr className="border-b" style={{ borderColor: BORDER }}>
                      <th className="px-2 py-1 text-[#6b7280]">Referrals</th>
                      <th className="px-2 py-1 text-right text-[#6b7280]">TON</th>
                      <th className="px-2 py-1 text-right text-[#6b7280]">Status</th>
                      <th className="px-2 py-1 text-right text-[#6b7280]">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earnings.recent.map((r, i) => (
                      <tr key={r.id} className="border-b" style={{ borderColor: BORDER, backgroundColor: i % 2 === 0 ? BG : PANEL2 }}>
                        <td className="px-2 py-1.5 text-white">Referral fee</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-[#5eead4]">{formatNumber(r.amountSol, { decimals: 5 })}</td>
                        <td className="px-2 py-1.5 text-right text-[#9ca3af]">{r.paidOut ? 'Paid' : 'Pending'}</td>
                        <td className="px-2 py-1.5 text-right text-[#6b7280]">{formatRelativeTime(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'leaderboard' ? (
        <div className="min-h-0 flex-1 overflow-auto p-2">
          <section className="rounded border p-3" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
            <div className="mx-auto flex max-w-[260px] flex-col items-center text-center">
              <div className="h-14 w-14 rounded-md border p-1" style={{ borderColor: '#6ea7ff', backgroundColor: '#20263a' }}>
                <div className="h-full w-full rounded bg-[#f3b34c]" />
              </div>
              <p className="mt-1 text-[11px] text-[#d1d5db]">{username}</p>
              <p className="text-[22px] font-semibold leading-tight text-white">{formatNumber(points.totalPoints)}</p>
              <div className="mt-1 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: BORDER }}>
                <Medal className="h-3 w-3 text-[#a78bfa]" /> Rank #{you?.rank ?? points.rank ?? 0}
              </div>
            </div>
          </section>

          <section className="mt-2 rounded border" style={{ borderColor: BORDER, backgroundColor: PANEL }}>
            <div className="flex items-center justify-between border-b px-2 py-1" style={{ borderColor: BORDER }}>
              <span className="text-[11px] font-semibold text-white">Points Leaderboard</span>
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1 rounded border px-2 py-0.5" style={{ borderColor: BORDER, backgroundColor: BG }}>
                  <Search className="h-3 w-3 text-[#6b7280]" />
                  <input
                    value={searchLb}
                    onChange={(e) => setSearchLb(e.target.value)}
                    placeholder="Search username or wallet"
                    className="w-36 border-0 bg-transparent text-[10px] text-white outline-none placeholder:text-[#4b5563]"
                  />
                </div>
                {['1', '2', '3', '4', 'YOU'].map((p) => (
                  <button key={p} className={cn('rounded px-1.5 py-1 text-[10px] font-semibold', p === '1' ? 'bg-white/10 text-white' : 'text-[#9ca3af] hover:text-white')}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[52vh] overflow-auto">
              <table className="w-full border-collapse text-left text-[11px]">
                <thead className="sticky top-0" style={{ backgroundColor: PANEL2 }}>
                  <tr className="border-b" style={{ borderColor: BORDER }}>
                    <th className="px-2 py-1 text-[#6b7280]">Rank</th>
                    <th className="px-2 py-1 text-[#6b7280]">User ID</th>
                    <th className="px-2 py-1 text-right text-[#6b7280]">Total Points</th>
                    <th className="px-2 py-1 text-right text-[#6b7280]">Trading</th>
                    <th className="px-2 py-1 text-right text-[#6b7280]">Referrals</th>
                  </tr>
                </thead>
                <tbody>
                  {lb.rows.map((r, i) => (
                    <tr key={r.user_id} className="border-b" style={{ borderColor: BORDER, backgroundColor: i % 2 === 0 ? BG : PANEL2 }}>
                      <td className="px-2 py-1.5 text-white">{r.rank}</td>
                      <td className="px-2 py-1.5 text-[#d1d5db]">{r.username ?? shortenAddress(r.wallet_address ?? r.user_id, 4)}</td>
                      <td className="px-2 py-1.5 text-right">
                        <span className="rounded-full border px-2 py-0.5 tabular-nums text-white" style={{ borderColor: BORDER }}>
                          {formatNumber(r.total_points)}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right text-[#9ca3af]">{formatNumber(Math.max(0, r.total_points - r.active_days * 10))}</td>
                      <td className="px-2 py-1.5 text-right text-[#9ca3af]">{formatNumber(r.active_days * 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'benefits' ? (
        <div className="min-h-0 flex-1 overflow-auto p-2">
          <p className="mb-3 max-w-3xl text-[11px] leading-snug text-[#9ca3af]">
            Pointer runs on <span className="text-white">TON</span>. Points, leaderboard rankings, and referral rewards
            are native to Pointer—Solana-only partner tiles have been removed. Third-party TON protocol perks will show
            up here when we integrate claim flows.
          </p>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <BenefitCard
              title="Pointer Points"
              description="Earn points from trading, trackers, and activity on Pointer. Everything is scored against your TON wallets."
              accent="#38bdf8"
              button="Open Points"
              href="/points"
            />
            <BenefitCard
              title="Leaderboard"
              description="Climb seasonal ranks and compare your score with the rest of the community."
              accent="#a78bfa"
              button="View leaderboard"
              href="/leaderboard"
            />
            <BenefitCard
              title="Referrals"
              description="Share your referral code and earn when friends trade on Pointer."
              accent="#4ade80"
              button="Open referrals"
              href="/referral"
            />
            <BenefitCard
              title="TON DEX activity"
              description="Volume routed through Pulse on launchpads and TON DEX routes (e.g. STON.fi, DeDust) counts toward Pointer Points. Direct reward claims from those protocols are not live yet in this UI."
              accent="#67e8f9"
              button="Coming soon"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
