'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight, Eye, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { ChainFocus } from '@/lib/squads/types';
import { DEMO_SQUADS } from '@/lib/squads/demo';
import type { DemoSquad } from '@/lib/squads/demo';
import { squadRoomCardMeta } from '@/lib/squads/traderCardMeta';
import { SquadGlassModal } from '@/components/squads/SquadGlassModal';
import {
  SquadChip,
  SquadPanel,
  SquadSortShell,
  squadCardHoverInteractiveClass,
} from '@/components/squads/squadsPrimitives';
import { cn } from '@/lib/utils/cn';

const MEMBER_RING: Record<string, string[]> = {
  'archon-desk': ['CR', 'HE', 'VO'],
  'perimeter-hl': ['HE', 'VO', 'CR'],
  'ton-signal': ['VO', 'HE', 'CR'],
};

export function RecruitSquadsView() {
  const [chains, setChains] = useState<Set<string>>(new Set(['all']));
  const [sort, setSort] = useState('signal');
  const [preview, setPreview] = useState<DemoSquad | null>(null);
  const [applySquad, setApplySquad] = useState<DemoSquad | null>(null);

  const toggleChain = (c: string) => {
    setChains((prev) => {
      const n = new Set(prev);
      if (c === 'all') return new Set(['all']);
      n.delete('all');
      if (n.has(c)) n.delete(c);
      else n.add(c);
      if (n.size === 0) n.add('all');
      return n;
    });
  };

  const list = useMemo(() => {
    let rows = [...DEMO_SQUADS];
    if (!chains.has('all')) {
      rows = rows.filter((s) =>
        s.chains.some((ch) => {
          if (chains.has('hyperliquid')) return ch === 'hyperliquid';
          if (chains.has('sol')) return ch === 'sol';
          if (chains.has('ton')) return ch === 'ton';
          if (chains.has('base')) return ch === 'base';
          return false;
        }),
      );
    }
    rows.sort((a, b) => {
      if (sort === 'signal') {
        const rank = { high: 0, medium: 1, low: 2, unknown: 3 };
        return rank[a.signalGrade] - rank[b.signalGrade];
      }
      return b.members - a.members;
    });
    return rows;
  }, [chains, sort]);

  function confirmApply(s: DemoSquad) {
    setApplySquad(null);
    toast.success(`Application sent to ${s.name}`, {
      description: 'You’ll get a response after operator review.',
    });
  }

  return (
    <>
      <div className="grid min-h-0 gap-5 lg:grid-cols-[1fr_minmax(0,296px)]">
        <div className="space-y-3">
          <SquadPanel padding="p-3" tone="premium">
            <div className="flex flex-wrap items-center gap-2">
              <SquadChip selected={chains.has('all')} onClick={() => toggleChain('all')}>
                All chains
              </SquadChip>
              <SquadChip selected={chains.has('sol')} onClick={() => toggleChain('sol')}>
                Solana
              </SquadChip>
              <SquadChip selected={chains.has('ton')} onClick={() => toggleChain('ton')}>
                TON
              </SquadChip>
              <SquadChip selected={chains.has('base')} onClick={() => toggleChain('base')}>
                Base
              </SquadChip>
              <SquadChip selected={chains.has('hyperliquid')} onClick={() => toggleChain('hyperliquid')}>
                Hyperliquid
              </SquadChip>
              <SquadChip>Room type</SquadChip>
              <SquadChip>Open seats</SquadChip>
              <SquadChip>Trust / Ethos</SquadChip>
              <div className="ml-auto">
                <SquadSortShell
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: 'signal', label: 'Highest signal' },
                    { value: 'members', label: 'Largest rooms' },
                  ]}
                />
              </div>
            </div>
          </SquadPanel>

          <ul className="flex flex-col gap-3">
            {list.map((s) => {
              const meta = squadRoomCardMeta(s);
              const initials = MEMBER_RING[s.slug] ?? ['OP', 'Q1', 'Q2'];

              return (
                <li key={s.id}>
                  <article
                    className={cn(
                      'relative overflow-hidden rounded-lg border border-[#2a3548] bg-gradient-to-b from-[#141c28]/98 to-[#090c11] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] transition',
                      squadCardHoverInteractiveClass,
                      meta.spotlight === 'invite_high' &&
                        'ring-1 ring-[#8b7cc9]/35 ring-offset-2 ring-offset-[#05070a]',
                    )}
                  >
                    {meta.spotlight !== 'standard' ? (
                      <SpotlightRibbon
                        secure={meta.spotlight === 'invite_high'}
                        label={
                          meta.spotlight === 'invite_high'
                            ? 'Invite only · high signal'
                            : 'High signal room'
                        }
                      />
                    ) : null}
                    <div className={cn('p-4', meta.spotlight !== 'standard' ? 'pt-8' : null)}>
                      <div className="flex flex-wrap items-start gap-4">
                        <div className="relative">
                          <div className="absolute -left-px -top-px h-3 w-3 rounded-full border border-[#0d1117] bg-[#4ade80] shadow-[0_0_12px_-2px_#22c55e]" />
                          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-md border border-[#3d4d63] bg-[#0f141f] text-[14px] font-bold ring-2 ring-black/65">
                            {s.monogram}
                          </div>
                          <MiniAvatarStack initials={initials} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                            <h3 className="text-[15px] font-semibold tracking-tight text-fg-primary">
                              {s.name}
                            </h3>
                            <VisibilityPill visibility={s.visibility} />
                            <Grade grade={s.signalGrade} />
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10.5px]">
                            <span className="inline-flex items-center gap-1 rounded border border-emerald-900/55 bg-emerald-950/25 px-1.5 py-px font-semibold uppercase tracking-wide text-emerald-200/90">
                              <Activity className="h-3 w-3" strokeWidth={2.2} />
                              {meta.lastActive}
                            </span>
                            <span className="rounded border border-[#354155]/85 bg-black/35 px-1.5 py-px text-[10px] font-medium text-[#aec7e8]">
                              {meta.pulseLine}
                            </span>
                          </div>
                          <p className="mt-2 max-w-[66ch] text-[12px] leading-relaxed text-fg-secondary">
                            {s.shortDescription}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {s.chains.map((c) => (
                              <ChainChip key={c} c={c} />
                            ))}
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                            <StatDd label="Members">
                              {s.members}
                            </StatDd>
                            <StatDd label="Open seats" accent accentClass="text-[#fde68a]">
                              {s.openSeatsCount}
                            </StatDd>
                            <StatDd label="Ethos floor" className="col-span-2 sm:col-span-1">
                              ≥{s.ethosFloor.toLocaleString()}
                            </StatDd>
                            <StatDd label="Trust gate" className="col-span-2 sm:col-span-2">
                              {s.trustRequirement}
                            </StatDd>
                          </div>
                        </div>
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.05] pt-4">
                        <button
                          type="button"
                          className="order-1 inline-flex min-h-[38px] min-w-[120px] flex-1 items-center justify-center gap-1.5 rounded-md bg-[#1f7ab8] py-2.5 text-[12px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-[#268fcc] sm:order-none sm:flex-none sm:px-6"
                          onClick={() => setApplySquad(s)}
                        >
                          Apply
                          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                        </button>
                        <button
                          type="button"
                          className="order-3 inline-flex min-h-[38px] flex-[1_1_40%] items-center justify-center gap-1.5 rounded-md border border-[#466484]/75 bg-[#121a2566] px-4 py-2.5 text-[11.5px] font-semibold text-fg-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-[#5c7fac] hover:bg-[#17202e] sm:order-none sm:flex-none"
                          onClick={() => setPreview(s)}
                        >
                          <Eye className="h-3.5 w-3.5" strokeWidth={2.2} />
                          Preview room
                        </button>
                        <Link
                          href={`/squads/room/${s.slug}`}
                          className="order-2 inline-flex min-h-[38px] flex-[1_1_28%] items-center justify-center rounded-md border border-dashed border-[#3d4f64]/95 bg-black/30 px-3 py-2.5 text-[11px] font-semibold text-[#8ec8f8] hover:border-[#5b7faa] hover:bg-[#0f1622] hover:text-[#bde3ff] sm:order-none"
                        >
                          Enter room
                        </Link>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="min-w-0 space-y-3 lg:sticky lg:top-[calc(var(--app-header-offset,0px)+12px)] lg:self-start">
          <SquadPanel tone="premium" className="relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-6 -top-20 h-40 w-40 rounded-full bg-[#274c7a]/22 blur-[50px]"
            />
            <div className="relative flex items-start gap-2 border-b border-white/[0.06] pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[#35608c]/55 bg-black/35">
                <ShieldCheck className="h-4 w-4 text-[#73befa]" strokeWidth={2.2} />
              </div>
              <div>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-fg-secondary">
                  Recruitment flow
                </h2>
                <p className="mt-1 text-[10.5px] leading-snug text-fg-muted">
                  Review path from application to shared workspace.
                </p>
              </div>
            </div>
            <ol className="relative mt-4 space-y-2.5 text-[11.5px] text-fg-secondary">
              <span className="absolute bottom-3 left-[13px] top-7 w-px bg-gradient-to-b from-[#3b6ea5]/65 to-transparent" />
              {[
                'Requirements — Ethos floors, identity gates, moderation.',
                'Application — edge, sizing, cadence.',
                'Operator review — policy + checkpoints.',
                'Join & contribute — watchlists, votes, alerts.',
              ].map((line, i) => (
                <li key={line} className="relative flex gap-3 pl-1">
                  <span className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#3f5f86]/65 bg-[#101925] text-[11px] font-bold text-[#8ecdff] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                    {i + 1}
                  </span>
                  <span className="leading-snug">{line}</span>
                </li>
              ))}
            </ol>
            <SquadPanel padding="p-3.5" tone="inset" className="relative z-[1] mt-4 ring-1 ring-white/[0.04]">
              <div className="flex gap-2">
                <Sparkles className="mt-px h-3.5 w-3.5 shrink-0 text-[#fcd34d]/90" strokeWidth={2.2} />
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-fg-muted">Build trust</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-fg-secondary">
                    Strong linkage and sustained activity improve discovery rank and approvals.
                  </p>
                  <Link
                    href="/squads/reputation"
                    className="mt-3 flex w-full items-center justify-center rounded-md border border-[#3d556f] bg-[#0e141d] py-2 text-[11px] font-semibold text-fg-primary transition hover:border-[#5c7faa] hover:bg-[#131c28]"
                  >
                    View reputation
                  </Link>
                </div>
              </div>
            </SquadPanel>
          </SquadPanel>
        </aside>
      </div>

      <SquadGlassModal open={Boolean(preview)} title={preview?.name ?? ''} onClose={() => setPreview(null)}>
        {preview ? (
          <div className="space-y-3 text-[12px] text-fg-secondary">
            <VisibilityPill visibility={preview.visibility} />
            <p>{preview.fullDescription}</p>
            <p className="text-fg-muted">
              Members {preview.members} · Open seats {preview.openSeatsCount} · {preview.trustMode}
            </p>
            <Link
              href={`/squads/room/${preview.slug}`}
              className="inline-flex w-full justify-center rounded-md bg-[#1f7ab8] py-2.5 text-[12px] font-semibold text-white hover:bg-[#268fcc]"
              onClick={() => setPreview(null)}
            >
              Open full room workspace
            </Link>
          </div>
        ) : null}
      </SquadGlassModal>

      <SquadGlassModal open={Boolean(applySquad)} title="Submit application" onClose={() => setApplySquad(null)}>
        {applySquad ? (
          <div className="space-y-3">
            <p className="text-[12px] text-fg-secondary">{applySquad.shortDescription}</p>
            <label className="grid gap-1 text-[11px] text-fg-muted">
              Message (optional)
              <textarea
                rows={4}
                className="resize-none rounded-md border border-[#2c3545] bg-[#0a0e14] px-2.5 py-2 text-[12px] text-fg-primary outline-none focus:border-[#3d6ea3]"
                placeholder="Briefly describe your lane, sizing, and what you contribute."
              />
            </label>
            <button
              type="button"
              className="w-full rounded-md bg-[#1f7ab8] py-2.5 text-[12px] font-semibold text-white hover:bg-[#268fcc]"
              onClick={() => confirmApply(applySquad)}
            >
              Send application
            </button>
          </div>
        ) : null}
      </SquadGlassModal>
    </>
  );
}

function SpotlightRibbon({ secure, label }: { secure: boolean; label: string }) {
  return (
    <div className="absolute left-0 right-0 top-0 flex justify-center">
      <div className="flex items-center gap-1 rounded-b-lg border-x border-b border-[#466484]/65 bg-[#152030]/92 px-3 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#bde2ff] shadow-[0_6px_20px_-8px_rgba(0,0,0,0.75)] backdrop-blur-sm">
        {secure ? (
          <Lock className="h-3 w-3 opacity-90" strokeWidth={2.2} />
        ) : (
          <Sparkles className="h-3 w-3 text-[#fde68a] opacity-90" strokeWidth={2.2} />
        )}
        {label}
      </div>
    </div>
  );
}

function MiniAvatarStack({ initials }: { initials: string[] }) {
  return (
    <div className="absolute bottom-[-6px] right-[-14px] flex -space-x-2">
      {initials.slice(0, 3).map((m, i) => (
        <div
          key={`${m}-${i}`}
          title="Member preview"
          className={cn(
            'relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0f141f] bg-gradient-to-br from-[#1c283d] to-[#101827] text-[9px] font-bold text-[#cae4ff]',
            i === 2 && '-mr-px',
          )}
        >
          {m}
        </div>
      ))}
    </div>
  );
}

function StatDd({
  label,
  children,
  accent,
  accentClass,
  className,
}: {
  label: string;
  children: ReactNode;
  accent?: boolean;
  accentClass?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-[#303b4f]/95 bg-black/38 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        accent && 'border-yellow-950/65 bg-yellow-950/12',
        className,
      )}
    >
      <p className="text-[8.5px] font-bold uppercase tracking-wide text-fg-muted">{label}</p>
      <p
        className={cn(
          'mt-1 text-[11.5px] font-semibold tabular-nums tracking-tight text-fg-primary',
          accent && accentClass,
        )}
      >
        {children}
      </p>
    </div>
  );
}

function VisibilityPill({ visibility }: { visibility: DemoSquad['visibility'] }) {
  const label =
    visibility === 'public'
      ? 'Public'
      : visibility === 'request_to_join'
        ? 'Request to join'
        : visibility === 'invite_only'
          ? 'Invite only'
          : 'Private';
  const cls =
    visibility === 'public'
      ? 'border-emerald-900/65 text-emerald-200/95 bg-emerald-950/[0.38]'
      : visibility === 'request_to_join'
        ? 'border-sky-900/65 text-[#bae6fd]/95 bg-[#0c4a6e]/24'
        : 'border-purple-950/85 text-purple-100/92 bg-purple-950/26';
  return (
    <span className={cn('rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]', cls)}>
      {label}
    </span>
  );
}

function Grade({ grade }: { grade: DemoSquad['signalGrade'] }) {
  const label = grade === 'high' ? 'Signal · high' : 'Signal · medium';
  const cls =
    grade === 'high'
      ? 'border-teal-950/85 text-teal-100/93 bg-teal-950/22'
      : 'border-amber-950/80 text-amber-100/90 bg-amber-950/[0.26]';
  return (
    <span className={cn('rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]', cls)}>
      {label}
    </span>
  );
}

function ChainChip({ c }: { c: ChainFocus }) {
  const label =
    c === 'sol'
      ? 'Solana'
      : c === 'ton'
        ? 'TON'
        : c === 'base'
          ? 'Base'
          : c === 'hyperliquid'
            ? 'Hyperliquid'
            : c === 'bnb'
              ? 'BNB'
              : c === 'multi'
                ? 'Multi-chain'
                : c;
  return (
    <span className="rounded-md border border-[#364151]/92 bg-black/42 px-2 py-0.5 text-[10px] font-medium text-[#b8cae4] shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
      {label}
    </span>
  );
}
