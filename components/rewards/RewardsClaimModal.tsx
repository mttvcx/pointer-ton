'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Diamond, Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { ChainGlyph } from '@/components/points/ChainGlyph';
import { GlassPanel } from '@/components/points/missionControlPrimitives';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { SOL_CLAIM_EPS } from '@/lib/rewards/constants';
import { formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';

type ClaimablesPayload = {
  referralFeesPendingSol: number;
  pointerPointsClaimable: number;
  cashbackPendingSol: number;
  lifetimePointerPoints: number;
  notes?: string;
};

function PointsGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 22 18"
      className={cn('shrink-0 text-fg-primary', className)}
      aria-hidden
    >
      <path fill="currentColor" d="M11 1l10 17H1L11 1z" opacity="0.9" />
      <path fill="currentColor" d="M11 5.5 6.25 17h9.5L11 5.5z" opacity="0.45" />
    </svg>
  );
}

function fmtClaimSol(n: number): string {
  return `+${formatNumber(Math.max(0, n), { decimals: 4 })}`;
}

function fmtClaimPts(n: number): string {
  return `+${formatNumber(Math.max(0, n), { decimals: 0 })}`;
}

function RewardPill({
  label,
  className,
  borderClassName,
  children,
  titleHint,
}: {
  label?: string;
  className?: string;
  borderClassName?: string;
  children: React.ReactNode;
  titleHint?: string;
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center gap-1',
        titleHint?.trim() || label ? 'group' : '',
        className,
      )}
      title={titleHint}
    >
      <span
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
          borderClassName,
          'bg-bg-sunken/80 backdrop-blur-sm',
        )}
      >
        {children}
      </span>
      {label ? (
        <span className="pointer-events-none absolute -top-7 left-1/2 z-[2] hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/12 bg-black/92 px-2 py-1 text-[9px] text-fg-secondary shadow-xl ring-1 ring-white/[0.04] group-hover:block">
          {label}
        </span>
      ) : null}
    </div>
  );
}

export function RewardsClaimModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const { authenticated, getAccessToken } = usePointerAuth();
  const qc = useQueryClient();

  const claimablesQ = useQuery({
    queryKey: ['me-claimables'],
    enabled: open && authenticated,
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
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(j.error ?? `claim_${res.status}`);
      return j.message ?? 'Recorded.';
    },
    onSuccess: async (msg) => {
      toast.success(msg);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['me-claimables'] }),
        qc.invalidateQueries({ queryKey: ['referral-earnings'] }),
      ]);
      onOpenChange(false);
    },
    onError: (e: Error) => {
      if (e.message === 'nothing_to_claim') {
        toast.message('Nothing to claim yet — keep earning.');
        return;
      }
      toast.error(e.message);
    },
  });

  const c = claimablesQ.data;

  const canClaimSolReferral =
    (c?.referralFeesPendingSol ?? 0) >= SOL_CLAIM_EPS && Number.isFinite(c?.referralFeesPendingSol);
  const canClaimPts = (c?.pointerPointsClaimable ?? 0) > 0;
  const canClaimCashback = (c?.cashbackPendingSol ?? 0) >= SOL_CLAIM_EPS;
  const hasAnything = Boolean(canClaimSolReferral || canClaimPts || canClaimCashback);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex animate-in fade-in items-center justify-center bg-black/75 px-3 py-6 backdrop-blur-sm duration-200"
      role="dialog"
      aria-modal
      aria-labelledby="rewards-claim-title"
    >
      <GlassPanel variant="quiet" glow="cyan" className="relative w-full max-w-md overflow-hidden p-6 shadow-2xl ring-1 ring-cyan-400/25">
        <button
          type="button"
          className="focus-ring absolute right-3 top-3 rounded-lg border border-white/12 p-2 text-fg-muted transition hover:bg-bg-hover hover:text-fg-primary"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.18) 1px, transparent 0)',
            backgroundSize: '14px 14px',
          }}
        />

        <div className="relative flex items-center gap-2">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-accent-primary/40 bg-gradient-to-br from-accent-primary/35 to-violet-600/30 shadow-inner ring-1 ring-white/15">
            <Diamond className="h-5 w-5 text-fg-primary" strokeWidth={2.2} aria-hidden />
            <Sparkles className="absolute -right-0.5 -top-0.5 h-3 w-3 text-accent-glow drop-shadow-[0_0_6px_rgb(var(--accent-primary-rgb))]" />
          </div>
          <h2 id="rewards-claim-title" className="text-[17px] font-semibold tracking-tight text-fg-primary">
            Claim
          </h2>
        </div>

        {!authenticated ? (
          <p className="relative mt-5 text-[13px] text-fg-secondary">Sign in to view claimable balances.</p>
        ) : claimablesQ.isLoading ? (
          <div className="relative mt-10 flex justify-center py-8">
            <Loader2 className="h-7 w-7 animate-spin text-accent-primary" />
          </div>
        ) : claimablesQ.isError ? (
          <p className="relative mt-5 text-[13px] text-signal-bear">Could not load claimables.</p>
        ) : (
          <>
            <div className="relative mx-auto mt-8 flex max-w-[280px] flex-col gap-6">
              <div className="flex justify-between gap-3">
                <div
                  className="group relative flex flex-col items-center gap-1"
                  title="SOL from referral fee share pending settlement."
                >
                  <div className="rounded-full bg-gradient-to-br from-violet-500/55 via-indigo-500/35 to-cyan-400/45 p-[1px] shadow-[0_0_24px_-10px_rgba(139,92,246,0.55)]">
                    <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-bg-sunken/95 px-3.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                      <ChainGlyph chain="sol" className="!h-5 !w-5" title="Solana" />
                      <span className="tabular-nums text-[15px] font-bold text-fg-primary">
                        {fmtClaimSol(c?.referralFeesPendingSol ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>

                <RewardPill
                  borderClassName="border-white/15 ring-1 ring-white/[0.05]"
                  label="Points available to claim"
                  titleHint="Pointer points accrued for Rewards redemption."
                >
                  <PointsGlyph className="h-[18px] w-[22px]" />
                  <span className="tabular-nums text-[15px] font-bold text-fg-primary">
                    {fmtClaimPts(c?.pointerPointsClaimable ?? 0)}
                  </span>
                </RewardPill>
              </div>

              <div className="flex justify-center">
                <RewardPill
                  borderClassName="border-emerald-500/45 ring-1 ring-emerald-400/35"
                  titleHint="Trading cashback pool — settles with referral payouts."
                  className="items-center"
                >
                  <span className="relative inline-flex items-center gap-2">
                    <ChainGlyph chain="sol" className="!h-5 !w-5" title="SOL cashback" />
                    <span className="absolute -bottom-1 -right-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-emerald-500/95 px-[3px] text-[8px] font-bold text-black ring-2 ring-black/70">
                      %
                    </span>
                  </span>
                  <span className="tabular-nums text-[15px] font-bold text-fg-primary">
                    {fmtClaimSol(c?.cashbackPendingSol ?? 0)}
                  </span>
                </RewardPill>
              </div>
            </div>

            {c?.lifetimePointerPoints ? (
              <p className="relative mt-4 text-center text-[10px] text-fg-muted">
                Lifetime points balance ·{' '}
                <span className="tabular-nums font-semibold text-fg-secondary">
                  {formatNumber(c.lifetimePointerPoints, { decimals: 0 })}
                </span>{' '}
                (redemption tiers ship next — claimable stays separate)
              </p>
            ) : null}

            <button
              type="button"
              disabled={claimMut.isPending || !hasAnything || !authenticated}
              onClick={() => claimMut.mutate()}
              className={cn(
                'focus-ring relative mx-auto mt-8 flex w-[min(100%,320px)] items-center justify-center rounded-full px-6 py-3 text-[13px] font-semibold tracking-tight transition',
                hasAnything
                  ? 'bg-gradient-to-r from-accent-primary via-cyan-500 to-violet-500 text-black shadow-[0_10px_40px_-14px_rgb(var(--accent-primary-rgb))] hover:brightness-105 active:scale-[0.99]'
                  : 'cursor-not-allowed bg-bg-sunken text-fg-muted ring-1 ring-white/[0.06]',
              )}
            >
              {claimMut.isPending ? (
                <span className="inline-flex items-center gap-2 text-fg-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Claiming…
                </span>
              ) : hasAnything ? (
                'Claim all'
              ) : (
                'Nothing to Claim'
              )}
            </button>
          </>
        )}
      </GlassPanel>
    </div>
  );
}
