'use client';

import { useState, type ReactNode } from 'react';
import {
  BadgeCheck,
  ChevronRight,
  Clock,
  LayoutGrid,
  List,
  PencilLine,
  Plus,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import type { DemoTrader } from '@/lib/squads/demo';
import { DEMO_TRADERS } from '@/lib/squads/demo';
import { lfsCardMeta, traderDirectoryMeta } from '@/lib/squads/traderCardMeta';
import {
  OperatorSignalTone,
  SquadChip,
  SquadMonogram,
  SquadPanel,
  SquadSortShell,
  squadCardHoverInteractiveClass,
} from '@/components/squads/squadsPrimitives';
import { useSquadsLfsStore } from '@/store/squadsLfsStore';
import { useSquadsUiStore } from '@/store/squadsUiStore';
import { cn } from '@/lib/utils/cn';
import { EthosBadge } from '@/components/squads/EthosBadge';

export function LookingForSquadView() {
  const {
    broadcast,
    setBroadcast,
    statement,
    setStatement,
    preferredChains,
    strategyTags,
    addChain,
    addTag,
  } = useSquadsLfsStore();
  const [sort, setSort] = useState('signal');
  const [density, setDensity] = useState<'list' | 'grid'>('list');
  const openDemo = useSquadsUiStore((s) => s.openDemoTrader);

  const lfsTraders = DEMO_TRADERS.filter((t) => t.lookingForSquad);
  const sorted = [...lfsTraders].sort((a, b) =>
    sort === 'signal'
      ? (a.operatorLevel === 'high' ? 0 : 1) - (b.operatorLevel === 'high' ? 0 : 1)
      : b.volume30dUsd - a.volume30dUsd,
  );

  return (
    <div className="space-y-4">
      <SquadPanel tone="premium" className="relative overflow-hidden ring-1 ring-[#344c66]/35">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_95%_-10%,rgba(62,130,210,0.16),transparent_62%)]"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.06] pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-semibold tracking-tight text-fg-primary">Your LFS status</h2>
              {broadcast ? (
                <span className="rounded border border-[#4ade8066] bg-emerald-950/35 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[#bbf7d0] shadow-[0_0_20px_-10px_rgba(34,197,94,0.55)]">
                  Live
                </span>
              ) : (
                <span className="rounded border border-[#454f60] px-2 py-0.5 text-[9px] font-bold uppercase text-fg-muted">
                  Hidden
                </span>
              )}
            </div>
            <p className="mt-1 max-w-[60ch] text-[11.5px] leading-relaxed text-fg-muted">
              You&apos;re visible to operators building serious rooms. Switch off anytime — your chain
              wallets are never listed here.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[#3b525f]/72 bg-black/42 px-3.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-sm">
            <span className="text-[11px] font-semibold text-fg-secondary">Live and visible</span>
            <button
              type="button"
              role="switch"
              aria-checked={broadcast}
              onClick={() => setBroadcast(!broadcast)}
              className={cn(
                'relative h-9 w-[56px] rounded-full transition-colors',
                broadcast ? 'bg-[#1f7ab8]' : 'bg-[#343f4f]',
              )}
            >
              <span
                className={cn(
                  'absolute top-1 left-1 h-7 w-7 rounded-full bg-white shadow-md transition-transform',
                  broadcast ? 'translate-x-[24px]' : 'translate-x-0',
                )}
              />
            </button>
          </div>
        </div>

        <div className="relative mt-5 grid gap-5 lg:grid-cols-[2fr_minmax(0,1fr)]">
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-fg-muted">Preferred chains</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {preferredChains.map((c) => (
                  <SquadChip key={c} selected>
                    {c}
                  </SquadChip>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const next = window.prompt('Add chain label (e.g. Arbitrum)');
                    if (next?.trim()) addChain(next.trim());
                  }}
                  className="inline-flex h-[28px] w-[28px] items-center justify-center rounded-lg border border-dashed border-[#4a5f78] bg-[#0f141f] text-fg-muted transition hover:border-[#6090c8] hover:text-[#93c9ff]"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-fg-muted">Strategy tags</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {strategyTags.map((tag) => (
                  <SquadChip key={tag} selected>
                    {tag}
                  </SquadChip>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const next = window.prompt('Add strategy tag');
                    if (next?.trim()) addTag(next.trim());
                  }}
                  className="inline-flex h-[28px] w-[28px] items-center justify-center rounded-lg border border-dashed border-[#4a5f78] bg-[#0f141f] text-fg-muted transition hover:border-[#6090c8] hover:text-[#93c9ff]"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </div>
            </div>
            <label className="grid gap-2 text-[11px] text-fg-muted">
              <span className="inline-flex items-center gap-2 font-semibold text-fg-secondary">
                <PencilLine className="h-3.5 w-3.5 text-[#6aa7e6]" strokeWidth={2} />
                LFS statement
              </span>
              <textarea
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                rows={3}
                className={cn(
                  'resize-none rounded-xl border border-[#314252]/92 bg-black/52 px-3.5 py-3 text-[12px] leading-relaxed text-fg-primary shadow-[inset_0_2px_10px_rgba(0,0,0,0.35)] outline-none placeholder:text-fg-muted',
                  'focus:border-[#4a7399] focus:ring-2 focus:ring-[#3b6ea5]/35',
                )}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-1">
            <StatMiniCard
              label="Profile views · 30d"
              value="24"
              hint="+8 vs prior window"
              tone="cyan"
              icon={<span className="text-[10px] font-semibold text-[#93cbe8]">VIEWS</span>}
            />
            <StatMiniCard
              label="Invites received"
              value="3"
              hint="Waiting on your reply"
              tone="mint"
              icon={<Send className="h-4 w-4 text-[#6ee7b7]" strokeWidth={2} />}
            />
          </div>
        </div>
      </SquadPanel>

      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold text-fg-primary">Operators currently looking for squad</h3>
            <p className="mt-1 text-[11.5px] text-fg-muted">
              Join high-signal operators who are open to building.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SquadChip>Filters</SquadChip>
            <SquadSortShell
              value={sort}
              onChange={setSort}
              options={[
                { value: 'signal', label: 'Highest signal' },
                { value: 'volume', label: 'Volume' },
              ]}
            />
            <button
              type="button"
              onClick={() => setDensity(density === 'list' ? 'grid' : 'list')}
              className="rounded-xl border border-[#364655] bg-[#0f151d] p-2 text-fg-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] hover:border-[#54708c] hover:text-fg-secondary"
              aria-label={density === 'list' ? 'Grid view' : 'List view'}
            >
              {density === 'list' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <ul
          className={cn('mt-3 flex flex-col gap-2.5', density === 'grid' && 'sm:grid sm:grid-cols-2 sm:gap-3')}
        >
          {sorted.map((t) => (
            <LfsCard key={t.id} t={t} onProfile={() => openDemo(t)} />
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatMiniCard({
  label,
  value,
  hint,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'cyan' | 'mint';
  icon: ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-gradient-to-b px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-black/25',
        tone === 'cyan'
          ? 'border-[#2e5a76]/82 from-[#102537]/94 to-black/72'
          : 'border-emerald-950/80 from-emerald-950/22 to-black/70',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-fg-muted">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-[26px] font-semibold tabular-nums leading-none tracking-tight text-fg-primary">
        {value}
      </p>
      <p className="mt-2 text-[10px] font-medium leading-snug text-fg-muted">{hint}</p>
    </div>
  );
}

function LfsCard({ t, onProfile }: { t: DemoTrader; onProfile: () => void }) {
  const lm = lfsCardMeta(t);
  const dm = traderDirectoryMeta(t);
  const sigLevel =
    t.operatorLevel === 'high' ? 'high' : t.operatorLevel === 'medium' ? 'medium' : 'low';

  return (
    <li>
      <div
        className={cn(
          'rounded-lg border border-[#2c3849] bg-gradient-to-br from-[#141b27]/92 via-[#0d111a] to-[#080c12] p-px shadow-inner',
          squadCardHoverInteractiveClass,
        )}
      >
        <div className="flex flex-col rounded-[7px] border border-transparent bg-[#0e131c]/92 p-3.5 sm:flex-row sm:gap-4">
          <SquadMonogram className={cn('shadow-lg', t.avatarTint)} live={t.operatorLevel === 'high'}>
            {t.monogram}
          </SquadMonogram>

          <div className="mt-4 min-w-0 flex-1 sm:mt-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[14px] font-semibold tracking-tight text-fg-primary">{t.displayName}</span>
              <span className="text-[11px] font-medium text-[#82c2f9]">@{t.handle}</span>
              {t.ethosVerified ? (
                <BadgeCheck className="h-4 w-4 text-[#6ee7b7]" strokeWidth={2.2} />
              ) : null}
              <EthosBadge profile={t.ethos} size="xs" />
              <OperatorSignalTone level={sigLevel} />
            </div>

            <p className="mt-2 text-[11.5px] leading-snug text-fg-secondary">{t.shortBio}</p>

            <div className="mt-2.5 flex flex-wrap gap-1">
              <span className="inline-flex items-center gap-1 rounded border border-sky-900/52 bg-black/43 px-1.5 py-px text-[10px] font-semibold tabular-nums text-[#9dc9f5]">
                {t.volume30dUsd >= 1e6
                  ? `$${(t.volume30dUsd / 1e6).toFixed(2)}M`
                  : `$${(t.volume30dUsd / 1e3).toFixed(1)}K`}
                <span className="ml-px font-normal text-fg-muted">30d</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-[#364155] bg-black/43 px-1.5 py-px text-[10px] text-[#cae4ff]/88">
                <Clock className="h-3 w-3 shrink-0" strokeWidth={2} />
                {lm.response}
              </span>
              <span className="rounded border border-purple-950/74 bg-purple-950/18 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-purple-50/92">
                {lm.roomPref}
              </span>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {t.chainTags.map((c) => (
                <span
                  key={c}
                  className="rounded-md border border-[#364253] bg-black/52 px-1.5 py-px text-[10px] text-fg-muted"
                >
                  {c}
                </span>
              ))}
              <span className="rounded-md border border-dashed border-[#425368]/75 px-1.5 py-px text-[10px] text-fg-muted">
                +{Math.max(0, dm.watchedVenues - 2)} venues watched
              </span>
            </div>

            <div className="mt-3 grid gap-3 text-[11px] sm:grid-cols-2">
              <LfsBlock label="Looking for">{t.lfsLookingFor ?? t.lfsPitch}</LfsBlock>
              <LfsBlock label="Environment">{t.lfsEnvironment ?? '—'}</LfsBlock>
            </div>
          </div>

          <div className="mt-4 flex flex-col justify-between gap-3 border-t border-white/[0.05] pt-3 sm:mt-0 sm:w-[128px] sm:border-t-0 sm:border-l sm:border-white/[0.06] sm:pl-4 sm:pt-0">
            <div className="text-[11px] text-fg-muted sm:text-right">
              <p className="text-[12px] font-semibold tabular-nums text-fg-secondary">
                {(t.profileViews ?? 0).toLocaleString()} views
              </p>
              <p className="text-[12px] font-medium tabular-nums text-fg-secondary">{t.invitesReceived ?? 0} invites</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1 rounded-lg bg-[#1f7ab8] py-2.5 text-[11.5px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:bg-[#268fcc]"
                onClick={() =>
                  toast.message('Invite sent', {
                    description: `@${t.handle} will receive your invite.`,
                  })
                }
              >
                Invite
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-1 rounded-lg border border-[#466484]/80 bg-black/42 px-2.5 py-2 text-[11px] font-semibold text-[#bde3ff] hover:border-[#6b96c5] hover:bg-[#17202f]"
                onClick={onProfile}
              >
                View profile
                <ChevronRight className="h-4 w-4 opacity-80" strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

function LfsBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#303848]/93 bg-black/52 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <span className="text-[10px] font-bold uppercase tracking-wide text-fg-muted">{label}</span>
      <p className="mt-1 text-[11.25px] leading-snug text-fg-secondary">{children}</p>
    </div>
  );
}
