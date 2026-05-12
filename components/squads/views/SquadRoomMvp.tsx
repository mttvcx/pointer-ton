'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bell,
  ListChecks,
  MessageSquare,
  Radio,
  StickyNote,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { openCopilotQuickAsk } from '@/lib/copilot/quickAsk';
import {
  DEMO_AI_SUMMARY,
  DEMO_CHAT,
  DEMO_PINNED_SYMBOLS,
  DEMO_ROOM_ACTIVITIES,
  DEMO_ROOM_FEED,
  DEMO_SQUADS,
  DEMO_TRADERS,
} from '@/lib/squads/demo';
import { SquadPanel } from '@/components/squads/squadsPrimitives';
import { cn } from '@/lib/utils/cn';

const ROOM_TABS = [
  { id: 'feed' as const, label: 'Feed', icon: Activity },
  { id: 'watchlist' as const, label: 'Watchlist', icon: Radio },
  { id: 'signals' as const, label: 'Signals', icon: BarChart3 },
  { id: 'notes' as const, label: 'Notes', icon: StickyNote },
  { id: 'votes' as const, label: 'Votes', icon: ListChecks },
  { id: 'members' as const, label: 'Members', icon: Users },
];

export function SquadRoomMvp({ slug }: { slug: string }) {
  const [tab, setTab] = useState<(typeof ROOM_TABS)[number]['id']>('feed');
  const squad = DEMO_SQUADS.find((s) => s.slug === slug);
  const firstMint = DEMO_ROOM_FEED[0]?.mint ?? 'So11111111111111111111111111111111111111112';
  const name = squad?.name ?? slug;
  const desc =
    squad?.shortDescription ??
    'Shared workspace for alerts, consensus, watchlists — execution routes through Pointer.';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <Link
          href="/squads/my"
          className="mt-1 inline-flex h-8 items-center gap-1.5 rounded-md border border-[#252b36] px-2.5 text-[11px] font-semibold text-fg-muted hover:border-[#2f3d4d] hover:text-fg-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
          My squads
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#121820] text-[12px] font-bold ring-1 ring-[#283240]">
              {squad?.monogram ?? 'SQ'}
            </div>
            <div>
              <h1 className="text-[18px] font-semibold tracking-tight text-fg-primary">{name}</h1>
              <p className="mt-0.5 max-w-[70ch] text-[11.5px] leading-snug text-fg-muted">{desc}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            {squad?.chains?.map((ch) => (
              <span
                key={ch}
                className="rounded border border-[#27303d] px-1.5 py-px font-medium text-fg-secondary"
              >
                {ch === 'sol' ? 'Solana' : ch === 'ton' ? 'TON' : ch === 'base' ? 'Base' : ch === 'hyperliquid' ? 'Hyperliquid' : ch}
              </span>
            ))}
            <span className="rounded border border-[#2a4558] bg-[#1a2836] px-1.5 py-px text-[10px] font-semibold text-[#93c5fd]">
              {squad?.trustMode ?? 'Trusted room'}
            </span>
            <span className="text-fg-muted">
              {squad?.members ?? '—'} members · signal {squad?.signalGrade ?? '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[#1b2129] pb-0.5">
        {ROOM_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-2 text-[11px] font-semibold transition',
              tab === id
                ? 'border-[#2a4558] bg-[#0d1117] text-fg-primary'
                : 'border-transparent text-fg-muted hover:text-fg-secondary',
            )}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
            {label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_300px]">
        <div className="min-h-0 space-y-3">
          {tab === 'feed' ? (
            <FeedTab slug={slug} name={name} firstMint={firstMint} />
          ) : null}
          {tab === 'watchlist' ? <WatchlistTab /> : null}
          {tab === 'signals' ? <SignalsTab slug={slug} name={name} firstMint={firstMint} /> : null}
          {tab === 'notes' ? <NotesTab /> : null}
          {tab === 'votes' ? <VotesTab /> : null}
          {tab === 'members' ? <MembersTab /> : null}
        </div>

        <aside className="space-y-3">
          <SquadPanel padding="p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-fg-primary">
              <Bell className="h-3.5 w-3.5 text-[#67bffd]" strokeWidth={2.2} />
              Shared alerts
            </div>
            <ul className="mt-2 space-y-2 text-[11px]">
              <li className="text-fg-secondary">Basis leg risk rising on HL — size review.</li>
              <li className="text-fg-secondary">TON deployer vote closes in 2h.</li>
            </ul>
          </SquadPanel>
          <SquadPanel padding="p-3">
            <p className="text-[11px] font-semibold text-fg-primary">Pinned</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DEMO_PINNED_SYMBOLS.map((sym) => (
                <span
                  key={sym}
                  className="rounded border border-[#2c3545] bg-[#0a0e14] px-2 py-0.5 text-[10px] font-medium text-fg-secondary"
                >
                  {sym}
                </span>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 w-full rounded-md border border-[#2f3d4f] py-2 text-[10.5px] font-semibold text-fg-muted hover:bg-white/[0.04]"
              onClick={() => toast.message('Pin tokens', { description: 'Choose from Pulse or token pages.' })}
            >
              Add from watchlist
            </button>
          </SquadPanel>
        </aside>
      </div>
    </div>
  );
}

function FeedTab({
  slug,
  name,
  firstMint,
}: {
  slug: string;
  name: string;
  firstMint: string;
}) {
  return (
    <>
      <SquadPanel padding="p-0" className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[#1b2129] px-3 py-2">
          <Activity className="h-4 w-4 text-[#67bffd]" strokeWidth={2.2} />
          <span className="text-[11px] font-semibold tracking-tight text-fg-secondary">Room feed</span>
        </div>
        <ul className="max-h-[220px] divide-y divide-[#1b2129] overflow-y-auto">
          {DEMO_ROOM_ACTIVITIES.map((a) => (
            <li key={a.id} className="px-3 py-2.5 text-[11.5px]">
              <span className="text-[10px] font-medium tabular-nums text-fg-muted">{a.ago}</span>
              <span className="ml-2 text-fg-secondary">{a.text}</span>
            </li>
          ))}
        </ul>
      </SquadPanel>

      <SquadPanel padding="p-0" className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[#1b2129] px-3 py-2">
          <Radio className="h-4 w-4 text-fg-muted" strokeWidth={2.2} />
          <span className="text-[11px] font-semibold tracking-tight text-fg-secondary">Shared tokens</span>
        </div>
        <ul className="divide-y divide-[#1b2129]">
          {DEMO_ROOM_FEED.map((t) => (
            <li
              key={t.mint}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-[11.5px]"
            >
              <div>
                <span className="font-semibold text-fg-primary">{t.symbol}</span>
                <span className="text-fg-muted"> · {t.name}</span>
                <span className="ml-2 text-[10px] font-medium text-fg-muted">{t.chain}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold tabular-nums text-fg-secondary">
                  ${(t.mcUsd / 1e6).toFixed(1)}M mcap
                </span>
                <Link
                  href={`/token/${t.mint}`}
                  className="rounded-md border border-[#2f3d4f] px-2 py-1 text-[10px] font-semibold text-[#67bffd] hover:bg-white/[0.04]"
                >
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </SquadPanel>

      <SquadPanel padding="p-0" className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[#1b2129] px-3 py-2">
          <MessageSquare className="h-4 w-4 text-fg-muted" strokeWidth={2.2} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            Updates
          </span>
        </div>
        <ul className="space-y-2 px-3 py-3 text-[11.5px]">
          {DEMO_CHAT.map((m) => (
            <li key={m.id} className="leading-snug">
              <span className="font-semibold text-[#67bffd]">{m.who}</span>
              <span className="text-fg-muted"> · {m.at} — </span>
              <span className="text-fg-secondary">{m.text}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-[#1b2129] p-2">
          <input
            readOnly
            placeholder="Compose update…"
            className="w-full rounded-md border border-[#2c3545] bg-[#0a0e14] px-2.5 py-2 text-[11px] text-fg-muted"
            onFocus={() =>
              toast.message('Live compose', {
                description: 'Message delivery activates when your room backend is linked.',
              })
            }
          />
        </div>
      </SquadPanel>

      <SquadPanel padding="p-3">
        <p className="text-[11px] font-semibold text-fg-primary">Room recap</p>
        <p className="mt-2 text-[11.5px] leading-relaxed text-fg-secondary">{DEMO_AI_SUMMARY}</p>
        <button
          type="button"
          className="mt-3 w-full rounded-md border border-[#2f3d4f] py-2 text-[10.5px] font-semibold text-fg-secondary hover:bg-white/[0.04]"
          onClick={() =>
            openCopilotQuickAsk({
              entity: { type: 'token', id: firstMint, label: name },
              question: `Summarize squad room "${slug}" — risk cues, flows, and how operators are positioned.`,
            })
          }
        >
          Open in co-pilot
        </button>
      </SquadPanel>
    </>
  );
}

function WatchlistTab() {
  return (
    <SquadPanel>
      <p className="text-[12px] font-semibold text-fg-primary">Watchlist</p>
      <p className="mt-1 text-[11.5px] text-fg-muted">
        Same mints open in{' '}
        <Link href="/pulse" className="text-[#67bffd] hover:underline">
          Pulse
        </Link>{' '}
        and token routes — one market stack, shared context here.
      </p>
      <ul className="mt-3 space-y-2">
        {DEMO_ROOM_FEED.map((t) => (
          <li
            key={t.mint}
            className="flex items-center justify-between gap-2 rounded-md border border-[#252b36] bg-[#0a0e14] px-2.5 py-2 text-[11px]"
          >
            <span className="font-medium text-fg-primary">{t.symbol}</span>
            <Link href={`/token/${t.mint}`} className="text-[#67bffd] hover:underline">
              Trade
            </Link>
          </li>
        ))}
      </ul>
    </SquadPanel>
  );
}

function SignalsTab({
  slug,
  name,
  firstMint,
}: {
  slug: string;
  name: string;
  firstMint: string;
}) {
  return (
    <SquadPanel>
      <p className="text-[12px] font-semibold text-fg-primary">Signals</p>
      <div className="mt-2">
        <p className="text-[10px] font-medium text-fg-muted">Brief</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-fg-secondary">{DEMO_AI_SUMMARY}</p>
      </div>
      <ul className="mt-4 space-y-2 text-[11px] text-fg-muted">
        <li>Deployer lineage clean on last three Sol alerts.</li>
        <li>Smart-money divergence vs. retail chase on HL perp leg.</li>
        <li>TON liquidity rotation — moderated thread with receipts.</li>
      </ul>
      <button
        type="button"
        className="mt-4 w-full rounded-md bg-[#1f6daa] py-2 text-[11px] font-semibold text-white hover:bg-[#287fc4]"
        onClick={() =>
          openCopilotQuickAsk({
            entity: { type: 'token', id: firstMint, label: name },
            question: `What signals stand out across ${slug} right now?`,
          })
        }
      >
        Analyze with co-pilot
      </button>
    </SquadPanel>
  );
}

function NotesTab() {
  const notes = [
    { id: 'n1', who: 'CRYON', t: '19m ago', body: 'Entry thesis: SOL/BASE pair trade with explicit abort if basis widens.' },
    { id: 'n2', who: 'VOID', t: '1h ago', body: 'TON vote checklist pinned — reproducible screenshots required.' },
  ];
  return (
    <SquadPanel>
      <p className="text-[12px] font-semibold text-fg-primary">Notes</p>
      <ul className="mt-3 space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="rounded-md border border-[#252b36] bg-[#0a0e14] p-3">
            <p className="text-[10px] text-fg-muted">
              <span className="font-semibold text-[#67bffd]">{n.who}</span> · {n.t}
            </p>
            <p className="mt-1 text-[11.5px] text-fg-secondary">{n.body}</p>
          </li>
        ))}
      </ul>
    </SquadPanel>
  );
}

function VotesTab() {
  return (
    <SquadPanel>
      <p className="text-[12px] font-semibold text-fg-primary">Votes</p>
      <div className="mt-3 rounded-md border border-[#2a4558] bg-[#0a0e14] p-3">
        <p className="text-[11px] font-semibold text-fg-primary">Extend deployer checklist</p>
        <p className="mt-1 text-[11px] text-fg-muted">Quorum: Reputable+ · closes in 45m</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-md bg-[#1f6daa] py-2 text-[11px] font-semibold text-white hover:bg-[#287fc4]"
            onClick={() => toast.success('Vote recorded')}
          >
            Approve
          </button>
          <button
            type="button"
            className="flex-1 rounded-md border border-[#2f3d4f] py-2 text-[11px] font-semibold text-fg-secondary hover:bg-white/[0.04]"
            onClick={() => toast.message('Vote recorded')}
          >
            Abstain
          </button>
        </div>
      </div>
    </SquadPanel>
  );
}

function MembersTab() {
  return (
    <SquadPanel padding="p-0" className="overflow-hidden">
      <div className="border-b border-[#1b2129] px-3 py-2 text-[11px] font-semibold text-fg-muted">
        Operators
      </div>
      <ul className="divide-y divide-[#1b2129]">
        {DEMO_TRADERS.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-md text-[11px] font-bold',
                t.avatarTint,
              )}
            >
              {t.monogram}
            </div>
            <div>
              <p className="text-[13px] font-semibold text-fg-primary">{t.displayName}</p>
              <p className="text-[11px] text-fg-muted">@{t.handle}</p>
            </div>
          </li>
        ))}
      </ul>
    </SquadPanel>
  );
}
