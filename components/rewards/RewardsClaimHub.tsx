'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PointerBirdMark } from '@/components/branding/PointerBirdMark';
import { ChainGlyph } from '@/components/points/ChainGlyph';
import { PTR_TICKER } from '@/components/points/pointsUiConfig';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { SOL_CLAIM_EPS } from '@/lib/rewards/constants';
import { formatNumber, formatRelativeTime } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';

type ClaimablesPayload = {
  referralFeesPendingSol: number;
  pointerPointsClaimable: number;
  cashbackPendingSol: number;
  lifetimePointerPoints: number;
};

export type ReferralPayoutRow = {
  id: string;
  amountSol: number;
  paidOut: boolean;
  createdAt: string;
};

function fmtSolChip(n: number): string {
  return `+${formatNumber(Math.max(0, n), { decimals: 4 })}`;
}

function fmtPtsChip(n: number): string {
  return `+${formatNumber(Math.max(0, n), { decimals: 0 })}`;
}

export function RewardsClaimHub({
  lifetimePointsDisplay,
  referralRecent,
  referralPendingSol,
  referralPaidSol,
}: {
  lifetimePointsDisplay: number;
  referralRecent: ReferralPayoutRow[];
  referralPendingSol: number;
  referralPaidSol: number;
}) {
  const { authenticated, getAccessToken } = usePointerAuth();
  const qc = useQueryClient();

  const claimablesQ = useQuery({
    queryKey: ['me-claimables'],
    enabled: authenticated,
    staleTime: 15_000,
    queryFn: async (): Promise<ClaimablesPayload> => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/me/claimables', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await res.json().catch(() => ({}))) as ClaimablesPayload & { error?: string };
      if (!res.ok) throw new Error(j.error ?? 'claimables_failed');
      return j;
    },
  });

  const claimMut = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/me/claim', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(j.error ?? `claim_${res.status}`);
      return j.message ?? 'Recorded.';
    },
    onSuccess: async (msg) => {
      toast.success(msg);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['me-claimables'] }),
        qc.invalidateQueries({ queryKey: ['referral-earnings'] }),
      ]);
    },
    onError: (e: Error) => {
      if (e.message === 'nothing_to_claim') {
        toast.message('Nothing to claim yet.');
        return;
      }
      toast.error(e.message);
    },
  });

  const c = claimablesQ.data;

  const refPendingDisplay =
    c?.referralFeesPendingSol != null && Number.isFinite(c.referralFeesPendingSol)
      ? c.referralFeesPendingSol
      : referralPendingSol;

  const canClaimSolReferral =
    (c?.referralFeesPendingSol ?? 0) >= SOL_CLAIM_EPS && Number.isFinite(c?.referralFeesPendingSol);
  const canClaimPts = (c?.pointerPointsClaimable ?? 0) > 0;
  const canClaimCashback = (c?.cashbackPendingSol ?? 0) >= SOL_CLAIM_EPS;
  const hasAnything = Boolean(canClaimSolReferral || canClaimPts || canClaimCashback);

  return (
    <div
      id="rewards-claim-hub"
      className="relative flex min-h-0 w-full flex-col gap-4 rounded-2xl border border-border-subtle bg-gradient-to-b from-bg-hover/65 to-bg-base/80 p-4 shadow-[inset_0_1px_0_rgb(var(--fg-primary-rgb)/0.06),0_18px_52px_-34px_rgb(var(--accent-primary-rgb)/0.35)] ring-1 ring-accent-primary/20 backdrop-blur-md sm:p-5"
    >
      <p className="text-[13px] font-semibold text-fg-primary">Claim rewards</p>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border-subtle bg-bg-sunken/90 p-2 text-center">
          <ChainGlyph chain="sol" className="mx-auto !h-6 !w-6 opacity-95" />
          <p className="mt-1 tabular-nums text-[13px] font-bold text-fg-primary">{fmtSolChip(refPendingDisplay)}</p>
          <p className="text-[9px] font-medium uppercase tracking-wide text-fg-muted">Ref SOL</p>
        </div>
        <div className="rounded-xl border border-accent-primary/35 bg-accent-primary/8 p-2 text-center">
          <PointerBirdMark size={22} className="mx-auto opacity-95" />
          <p className="mt-1 tabular-nums text-[13px] font-bold text-fg-primary">
            {fmtPtsChip(c?.pointerPointsClaimable ?? 0)}
          </p>
          <p className="text-[9px] font-medium uppercase tracking-wide text-fg-muted">{PTR_TICKER}</p>
        </div>
        <div className="rounded-xl border border-signal-bull/35 bg-signal-bull/8 p-2 text-center">
          <div className="relative mx-auto w-fit">
            <ChainGlyph chain="sol" className="!h-6 !w-6 opacity-95" />
            <span className="absolute -bottom-0.5 -right-1 rounded bg-signal-bull px-[3px] text-[8px] font-bold leading-none text-bg-base">
              %
            </span>
          </div>
          <p className="mt-1 tabular-nums text-[13px] font-bold text-fg-primary">
            {fmtSolChip(c?.cashbackPendingSol ?? 0)}
          </p>
          <p className="text-[9px] font-medium uppercase tracking-wide text-fg-muted">Cashback</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg border border-border-subtle bg-bg-base/50 px-3 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-fg-muted">Lifetime {PTR_TICKER}</p>
          <p className="mt-0.5 flex items-center gap-1.5 tabular-nums text-[15px] font-bold text-fg-primary">
            <PointerBirdMark size={18} />
            {formatNumber(lifetimePointsDisplay, { decimals: 0 })}
          </p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-bg-base/50 px-3 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-fg-muted">Referral SOL</p>
          <p className="mt-0.5 tabular-nums text-fg-secondary">
            Pending <span className="font-semibold text-accent-glow">{formatNumber(refPendingDisplay, { decimals: 4 })}</span>
          </p>
          <p className="tabular-nums text-fg-secondary">
            Paid <span className="font-semibold text-fg-primary">{formatNumber(referralPaidSol, { decimals: 4 })}</span>
          </p>
        </div>
      </div>

      <div className="min-h-[80px] rounded-xl border border-border-subtle bg-bg-base/45">
        <div className="border-b border-border-subtle px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Referrals</p>
        </div>
        <div className="max-h-[120px] overflow-y-auto px-2 py-2">
          {!authenticated ? (
            <p className="px-2 py-4 text-center text-[11px] text-fg-muted">Sign in to view.</p>
          ) : referralRecent.length === 0 ? (
            <p className="px-2 py-4 text-center text-[11px] text-fg-muted">No referral fees yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {referralRecent.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 rounded-lg border border-border-subtle/80 bg-bg-hover/35 px-2.5 py-1.5 text-[11px]"
                >
                  <span className="font-semibold text-signal-bull">+{formatNumber(r.amountSol, { decimals: 5 })} SOL</span>
                  <span className="rounded-full bg-bg-sunken px-1.5 py-px text-[9px] font-semibold uppercase text-fg-muted">
                    {r.paidOut ? 'Paid' : 'Pending'}
                  </span>
                  <span className="ml-auto tabular-nums text-fg-muted">{formatRelativeTime(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={claimMut.isPending || !hasAnything || !authenticated || claimablesQ.isLoading}
        onClick={() => claimMut.mutate()}
        className={cn(
          'focus-ring flex min-h-[48px] w-full items-center justify-center rounded-xl px-4 py-3 text-center transition',
          hasAnything && authenticated
            ? 'bg-gradient-to-r from-accent-primary via-cyan-500 to-violet-500 text-[15px] font-bold text-black hover:brightness-110 active:scale-[0.99]'
            : 'cursor-not-allowed border border-border-subtle bg-bg-raised text-[13px] font-semibold text-fg-muted',
        )}
      >
        {claimMut.isPending ? (
          <span className="inline-flex items-center gap-2 font-bold text-black">
            <Loader2 className="h-5 w-5 animate-spin" />
            Claiming…
          </span>
        ) : !authenticated ? (
          'Sign in to claim'
        ) : claimablesQ.isLoading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </span>
        ) : hasAnything ? (
          'Claim rewards'
        ) : (
          'Nothing to claim'
        )}
      </button>
    </div>
  );
}
