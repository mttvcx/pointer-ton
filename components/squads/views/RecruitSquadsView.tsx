'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { DEMO_SQUADS } from '@/lib/squads/demo';
import type { DemoSquad } from '@/lib/squads/demo';
import { squadRoomCardMeta } from '@/lib/squads/traderCardMeta';
import { SquadGlassModal } from '@/components/squads/SquadGlassModal';
import { SquadChip, SquadPanel, SquadSortShell, squadCardHoverInteractiveClass } from '@/components/squads/squadsPrimitives';
import { cn } from '@/lib/utils/cn';
import { ChainIcon } from '@/components/squads/ChainIcon';
import { EthosGlyph } from '@/components/squads/EthosWordmark';

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
                <ChainIcon chain="sol" size={12} />
                Solana
              </SquadChip>
              <SquadChip selected={chains.has('ton')} onClick={() => toggleChain('ton')}>
                <ChainIcon chain="ton" size={12} />
                TON
              </SquadChip>
              <SquadChip selected={chains.has('base')} onClick={() => toggleChain('base')}>
                <ChainIcon chain="base" size={12} />
                Base
              </SquadChip>
              <SquadChip selected={chains.has('hyperliquid')} onClick={() => toggleChain('hyperliquid')}>
                <ChainIcon chain="hyperliquid" size={12} />
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
                      'overflow-hidden rounded-lg border border-border-subtle bg-bg-raised transition-colors hover:border-border',
                      squadCardHoverInteractiveClass,
                    )}
                  >
                    {meta.spotlight !== 'standard' ? (
                      <div className="flex items-center gap-1.5 rounded-t-lg bg-accent-ethos/10 px-4 py-1.5">
                        {meta.spotlight === 'invite_high' ? (
                          <Lock className="h-3 w-3 shrink-0 text-accent-ethos" strokeWidth={2.2} />
                        ) : (
                          <Sparkles className="h-3 w-3 shrink-0 text-accent-ethos" strokeWidth={2.2} />
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent-ethos">
                          {meta.spotlight === 'invite_high' ? (
                            <>
                              <span>Invite only</span>
                              <span className="mx-1 font-normal opacity-60">·</span>
                              <span>high signal</span>
                            </>
                          ) : (
                            'High signal room'
                          )}
                        </span>
                      </div>
                    ) : null}
                    <div className={cn('px-4 pb-4', meta.spotlight !== 'standard' ? 'pt-3' : 'pt-4')}>
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-bg-sunken text-sm font-bold text-fg-secondary">
                          {s.monogram}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                            <h3 className="text-base font-bold tracking-tight text-fg-primary">{s.name}</h3>
                            <VisibilityPill visibility={s.visibility} />
                            <Grade grade={s.signalGrade} />
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <MiniAvatarStack
                              members={initials.slice(0, 4).map((ini, idx) => ({
                                id: `${s.slug}-${idx}`,
                                initials: ini,
                              }))}
                              totalMembers={s.members}
                            />
                            <span className="text-xs text-fg-muted">{s.members} members</span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10.5px]">
                            <span className="inline-flex items-center gap-1 rounded-md bg-bg-sunken px-1.5 py-px font-semibold uppercase tracking-wide text-fg-secondary">
                              <Activity className="h-3 w-3" strokeWidth={2.2} />
                              {meta.lastActive}
                            </span>
                            <span className="rounded-md bg-bg-sunken px-1.5 py-px text-[10px] font-medium text-fg-muted">
                              {meta.pulseLine}
                            </span>
                          </div>
                          <p className="mt-2 max-w-[66ch] text-xs leading-snug text-fg-secondary">{s.shortDescription}</p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {s.chains.map((c) =>
                              c === 'multi' ? (
                                <span
                                  key={c}
                                  className="inline-flex items-center gap-1 rounded-md bg-bg-sunken px-1.5 py-0.5 text-[10px] font-medium text-fg-secondary"
                                  title="Multi-chain"
                                >
                                  Multi-chain
                                </span>
                              ) : (
                                <span
                                  key={c}
                                  className="inline-flex h-5 items-center gap-1 rounded-md bg-bg-sunken px-1.5 text-[10px] font-medium text-fg-secondary"
                                  title={
                                    c === 'sol'
                                      ? 'Solana'
                                      : c === 'ton'
                                        ? 'TON'
                                        : c === 'base'
                                          ? 'Base'
                                          : c === 'hyperliquid'
                                            ? 'Hyperliquid'
                                            : 'BNB'
                                  }
                                >
                                  <ChainIcon chain={c} size={11} />
                                </span>
                              ),
                            )}
                          </div>

                          <div className="mt-3 grid grid-cols-4 divide-x divide-border-subtle overflow-hidden rounded border border-border-subtle">
                            <StatCell label="Members">{s.members}</StatCell>
                            <StatCell label="Open seats">{s.openSeatsCount}</StatCell>
                            <StatCell label="Ethos floor">
                              <span className="inline-flex items-center gap-1">
                                <EthosGlyph className="h-2 w-2" />
                                <span className="font-bold tabular-nums text-accent-ethos">
                                  ≥{s.ethosFloor.toLocaleString()}
                                </span>
                              </span>
                            </StatCell>
                            <StatCell label="Signal">
                              <span className="tabular-nums">{s.signalGrade === 'high' ? 'High' : 'Medium'}</span>
                            </StatCell>
                          </div>

                          <div className="mt-3 flex flex-col gap-0.5">
                            <span className="text-[10px] uppercase tracking-[0.16em] text-fg-muted">Trust gate</span>
                            <span className="text-xs text-fg-secondary">{s.trustRequirement}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          className="flex h-9 flex-1 items-center justify-center rounded-md bg-accent-ethos text-sm font-semibold text-bg-base transition-colors hover:bg-accent-ethos-soft"
                          onClick={() => setApplySquad(s)}
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          className="flex h-9 shrink-0 items-center justify-center rounded-md bg-bg-sunken px-3 text-sm font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary"
                          onClick={() => setPreview(s)}
                        >
                          Preview
                        </button>
                      </div>
                      <Link
                        href={`/squads/room/${s.slug}`}
                        className="mt-2 flex w-full items-center justify-center text-xs font-medium text-accent-ethos hover:text-accent-glow"
                      >
                        Enter room
                        <ArrowRight className="ml-0.5 h-3 w-3 shrink-0" strokeWidth={2.2} />
                      </Link>
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
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-ethos/10">
                <ShieldCheck className="h-4 w-4 text-accent-ethos" strokeWidth={2.2} />
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
                  <span className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-ethos/10 text-[11px] font-bold text-accent-ethos tabular-nums">
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
                    className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-bg-sunken py-2 text-xs font-medium text-accent-ethos transition-colors hover:bg-bg-hover hover:text-accent-glow"
                  >
                    View reputation
                    <ArrowRight className="h-3 w-3" strokeWidth={2.2} />
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
              className="inline-flex w-full justify-center rounded-lg bg-accent-ethos py-2.5 text-xs font-semibold text-bg-base transition hover:bg-accent-ethos-soft"
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
                className="resize-none rounded-md border border-border-subtle bg-bg-sunken px-2.5 py-2 text-xs text-fg-primary outline-none placeholder:text-fg-muted focus:border-accent-ethos/50 focus:outline-none focus:ring-1 focus:ring-accent-ethos/20"
                placeholder="Briefly describe your lane, sizing, and what you contribute."
              />
            </label>
            <button
              type="button"
              className="w-full rounded-lg bg-accent-ethos py-2.5 text-xs font-semibold text-bg-base transition hover:bg-accent-ethos-soft"
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

function MiniAvatarStack({
  members,
  totalMembers,
}: {
  members: { id: string; initials: string }[];
  totalMembers: number;
}) {
  const extra = Math.max(0, totalMembers - members.length);
  return (
    <div className="flex -space-x-1.5">
      {members.map((m) => (
        <div
          key={m.id}
          title="Member preview"
          className="relative flex h-6 w-6 items-center justify-center rounded-full bg-bg-sunken text-[9px] font-bold text-fg-secondary ring-2 ring-bg-raised"
        >
          {m.initials}
        </div>
      ))}
      {extra > 0 ? (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-sunken text-[9px] font-semibold text-fg-muted ring-2 ring-bg-raised">
          +{extra}
        </div>
      ) : null}
    </div>
  );
}

function StatCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col bg-bg-raised px-3 py-2">
      <span className="text-[10px] uppercase tracking-wider text-fg-muted">{label}</span>
      <span className="mt-0.5 text-sm font-semibold tabular-nums text-fg-primary">{children}</span>
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
      ? 'bg-emerald-950/38 text-emerald-200'
      : visibility === 'request_to_join'
        ? 'bg-signal-info/10 text-signal-info'
        : 'bg-fg-muted/15 text-fg-secondary';
  return (
    <span className={cn('rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]', cls)}>
      {label}
    </span>
  );
}

function Grade({ grade }: { grade: DemoSquad['signalGrade'] }) {
  const label = grade === 'high' ? 'Signal · high' : 'Signal · medium';
  const cls =
    grade === 'high' ? 'bg-signal-bull/15 text-signal-bull' : 'bg-accent-ethos/10 text-accent-ethos';
  return (
    <span className={cn('rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]', cls)}>
      {label}
    </span>
  );
}
