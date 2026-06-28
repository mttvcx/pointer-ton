'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';

export type InsightXDetailTab = 'bundlers' | 'snipers' | 'insiders' | 'security';

type FlaggedWallet = { address: string; name: string | null; percentage: number; reasons: string[] };
type Group = { totalPct: number | null; wallets: FlaggedWallet[] };
type DetailResp = {
  configured: boolean;
  bundlers?: Group;
  snipers?: Group;
  insiders?: Group;
  scanner?: { score: number | null; message: string | null; reasons: string[] } | null;
  error?: string;
};

const TAB_TONE: Record<InsightXDetailTab, string> = {
  bundlers: 'text-violet-400',
  snipers: 'text-yellow-400',
  insiders: 'text-rose-400',
  security: 'text-sky-400',
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[260px] items-center justify-center px-6 text-center text-[12px] text-fg-muted">
      {children}
    </div>
  );
}

function WalletList({ tab, group }: { tab: InsightXDetailTab; group: Group }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle/40 px-4 py-2.5">
        <span className="text-[12px] font-semibold capitalize text-fg-primary">
          {group.wallets.length} {tab}
        </span>
        {group.totalPct != null ? (
          <span className={cn('text-[12px] font-semibold tabular-nums', TAB_TONE[tab])}>
            {group.totalPct.toFixed(1)}% of supply
          </span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {group.wallets.map((w, i) => (
          <div
            key={w.address}
            className="flex items-center gap-3 border-b border-border-subtle/30 px-4 py-2"
          >
            <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-fg-muted">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">
              {w.name ? (
                <span className="text-[12px] font-semibold text-fg-primary">{w.name}</span>
              ) : (
                <span className="text-[12px] tabular-nums text-fg-secondary">{shortenAddress(w.address, 5)}</span>
              )}
              {w.reasons.length > 0 ? (
                <span className="ml-2 text-[10px] text-fg-muted">{w.reasons.join(' · ')}</span>
              ) : null}
            </span>
            <span className={cn('shrink-0 text-[12px] font-semibold tabular-nums', TAB_TONE[tab])}>
              {w.percentage.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecurityView({ scanner }: { scanner: NonNullable<DetailResp['scanner']> }) {
  const score = scanner.score;
  const tone =
    score == null
      ? { Icon: ShieldQuestion, cls: 'text-fg-muted', ring: 'border-border-subtle' }
      : score >= 70
        ? { Icon: ShieldCheck, cls: 'text-signal-bull', ring: 'border-signal-bull/40' }
        : score >= 40
          ? { Icon: ShieldAlert, cls: 'text-yellow-400', ring: 'border-yellow-500/40' }
          : { Icon: ShieldAlert, cls: 'text-signal-bear', ring: 'border-signal-bear/40' };
  const { Icon } = tone;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className={cn('flex items-center gap-3 rounded-xl border bg-bg-sunken/40 p-4', tone.ring)}>
        <Icon className={cn('h-8 w-8 shrink-0', tone.cls)} strokeWidth={2} />
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={cn('text-[20px] font-bold tabular-nums', tone.cls)}>
              {score != null ? score : '—'}
            </span>
            <span className="text-[11px] text-fg-muted">/ 100 safety</span>
          </div>
          {scanner.message ? (
            <p className={cn('text-[12px] font-semibold', tone.cls)}>{scanner.message}</p>
          ) : null}
        </div>
      </div>
      {scanner.reasons.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {scanner.reasons.map((r, i) => (
            <li key={i} className="flex gap-2 text-[11.5px] leading-snug text-fg-secondary">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-fg-muted" />
              {r}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-fg-muted">No specific risk flags returned by the scanner.</p>
      )}
    </div>
  );
}

/** Bundlers / Snipers / Insiders / Security detail from InsightX (one shared fetch). */
export function InsightXDetailView({
  mint,
  network,
  tab,
}: {
  mint: string;
  network: string | null;
  tab: InsightXDetailTab;
}) {
  const q = useQuery({
    queryKey: ['ix-detail', mint, network],
    queryFn: async () => {
      const r = await fetch(`/api/insightx/detail/${encodeURIComponent(mint)}?network=${network}`);
      return (await r.json()) as DetailResp;
    },
    enabled: Boolean(network),
    staleTime: 15 * 60_000,
    retry: false,
  });

  if (!network) return <Centered>InsightX has no coverage on this chain.</Centered>;
  if (q.isLoading) {
    return (
      <Centered>
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </span>
      </Centered>
    );
  }
  if (q.data?.configured === false) {
    return <Centered>Connect an InsightX key to reveal bundlers, snipers, insiders and the security scan.</Centered>;
  }
  if (q.isError || q.data?.error) return <Centered>Detail unavailable for this token.</Centered>;

  if (tab === 'security') {
    if (!q.data?.scanner) return <Centered>No security scan available for this token.</Centered>;
    return <SecurityView scanner={q.data.scanner} />;
  }

  const group = q.data?.[tab];
  if (!group || group.wallets.length === 0) {
    return <Centered>No {tab} detected for this token.</Centered>;
  }
  return <WalletList tab={tab} group={group} />;
}
