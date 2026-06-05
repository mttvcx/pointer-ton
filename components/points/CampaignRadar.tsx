'use client';

import { ArrowRight, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { ChainGlyph } from '@/components/points/ChainGlyph';
import { GlassPanel } from '@/components/points/missionControlPrimitives';
import {
  DEMO_ECOSYSTEM_OPPORTUNITIES,
  ECOSYSTEM_RADAR_STATS,
  opportunityStatusLabel,
  type DemoOpportunity,
  type OpportunityKind,
} from '@/components/points/ecosystemOpportunitiesDemo';
import {
  ECOSYSTEM_CAMPAIGNS,
  type EcosystemCampaignId,
} from '@/components/points/pointsUiConfig';
import { cn } from '@/lib/utils/cn';

function kindStyles(kind: OpportunityKind): string {
  switch (kind) {
    case 'live':
      return 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100 shadow-[0_0_20px_-10px_rgba(34,211,238,0.45)]';
    case 'coming_soon':
      return 'border-white/10 bg-bg-base/60 text-fg-muted';
    case 'snapshot_soon':
      return 'border-violet-400/30 bg-violet-500/10 text-violet-100';
    case 'partner_verified':
      return 'border-amber-400/25 bg-amber-500/10 text-amber-100';
    case 'boosted_route':
      return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
    default:
      return 'border-white/10 bg-bg-base/60 text-fg-muted';
  }
}

function OpportunityCard({ row }: { row: DemoOpportunity }) {
  return (
    <GlassPanel variant="quiet" className="flex h-full flex-col p-4 ring-1 ring-white/[0.04] transition hover:border-white/15 hover:shadow-[0_16px_48px_-32px_rgba(0,0,0,0.85)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-[13px] font-bold text-white shadow-inner ring-1 ring-white/10',
              row.logoClassName,
            )}
          >
            {row.logoLetter}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold tracking-tight text-fg-primary">{row.projectName}</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-fg-muted">{row.chainLabel}</p>
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide',
            kindStyles(row.kind),
          )}
        >
          {opportunityStatusLabel(row.kind)}
        </span>
      </div>
      <dl className="space-y-2 text-[11px] leading-snug">
        <div className="flex justify-between gap-2 border-t border-white/[0.05] pt-2">
          <dt className="text-fg-muted">Reward</dt>
          <dd className="text-right font-medium text-fg-secondary">{row.rewardType}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">Eligibility</dt>
          <dd className="max-w-[58%] text-right text-fg-secondary">{row.eligibility}</dd>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-bg-base/50 px-2 py-1.5 ring-1 ring-white/[0.03]">
          <span className="text-[10px] uppercase tracking-wide text-fg-muted">Window</span>
          <span className="tabular-nums text-[11px] font-semibold text-accent-glow">{row.timeLabel}</span>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="focus-ring btn-press inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/12 bg-bg-hover/80 px-3 py-2 text-[11px] font-semibold text-fg-primary transition hover:border-cyan-400/35 hover:text-accent-glow min-[420px]:flex-none"
          onClick={() => toast.message('Campaign detail drawer ships with partner integrations.')}
        >
          View details
          <ChevronRight className="h-3.5 w-3.5 opacity-70" />
        </button>
        {row.showVerify ? (
          <button
            type="button"
            className="focus-ring btn-press inline-flex flex-1 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-[11px] font-semibold text-cyan-100 ring-1 ring-cyan-400/25 transition hover:bg-cyan-500/15 min-[420px]:flex-none"
            onClick={() => toast.message('Wallet verification opens when campaign contracts go live.')}
          >
            Verify wallet
          </button>
        ) : (
          <button
            type="button"
            className="focus-ring btn-press inline-flex flex-1 items-center justify-center rounded-lg border border-border-subtle px-3 py-2 text-[11px] font-medium text-fg-secondary transition hover:border-border-default hover:text-fg-primary min-[420px]:flex-none"
            onClick={() => toast.message('Coming soon.')}
          >
            Connect
          </button>
        )}
      </div>
    </GlassPanel>
  );
}

export function CampaignRadarSection({
  selected,
}: {
  selected: EcosystemCampaignId | null;
}) {
  const chainMeta = selected ? ECOSYSTEM_CAMPAIGNS.find((c) => c.id === selected) : null;
  const stats = selected ? ECOSYSTEM_RADAR_STATS[selected] : null;
  const rows = selected ? DEMO_ECOSYSTEM_OPPORTUNITIES[selected] ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-fg-muted">Campaign radar</h2>
        </div>
      </div>

      {!selected ? (
        <GlassPanel variant="quiet" glow="cyan" className="p-8 text-center">
          <p className="text-[13px] font-semibold text-fg-primary">Pick a campaign above</p>
        </GlassPanel>
      ) : (
        <>
          <GlassPanel variant="primary" glow="violet" className="p-5 sm:p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-bg-base/60 shadow-inner ring-1 ring-white/[0.06]">
                  <ChainGlyph chain={selected} className="h-9 w-9" title={chainMeta?.label} />
                  <span className="absolute -right-1 -top-1 flex h-5 items-center rounded-full border border-cyan-400/35 bg-cyan-500/15 px-1.5 text-[9px] font-bold uppercase tracking-wide text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.35)]">
                    Active
                  </span>
                </div>
                <div>
                  <p className="text-[18px] font-semibold tracking-tight text-fg-primary">{chainMeta?.label}</p>
                  <p className="mt-1 text-[12px] text-fg-secondary">{chainMeta?.tagline}</p>
                </div>
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-auto lg:min-w-[340px]">
                <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/[0.07] px-4 py-3 ring-1 ring-cyan-400/15">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Boost</p>
                  <p className="mt-1 text-[13px] font-semibold text-fg-primary">{stats?.boostLabel}</p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-bg-base/50 px-4 py-3 ring-1 ring-white/[0.04]">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Routes</p>
                  <p className="mt-1 text-[13px] font-semibold text-fg-primary">{stats?.routesLabel}</p>
                </div>
                <div className="rounded-xl border border-violet-400/20 bg-violet-500/[0.07] px-4 py-3 ring-1 ring-violet-400/15">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Referral weight</p>
                  <p className="mt-1 text-[13px] font-semibold text-fg-primary">{stats?.referralWeight}</p>
                </div>
              </div>
            </div>
          </GlassPanel>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-fg-muted">
                Live opportunities
              </h3>
              <ArrowRight className="h-3.5 w-3.5 text-accent-glow opacity-80" aria-hidden />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => (
                <OpportunityCard key={row.id} row={row} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
