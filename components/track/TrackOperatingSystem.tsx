'use client';

import Link from 'next/link';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, History, Layers, Radar, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import type {
  AutomationGlobalSettings,
  AutomationHistoryEntry,
  AutomationTriggerType,
  StoredAutomationRule,
} from '@/lib/track/automation/types';
import { normalizeXHandle } from '@/lib/track/automation/engine';
import type { KolHandleRow } from '@/lib/track/kolHandlesLocal';
import { useUIStore } from '@/store/ui';
import {
  cloneTriggers,
  useTrackAutomationStore,
} from '@/store/trackAutomation';
import { cn } from '@/lib/utils/cn';
import type { PulseColumnId } from '@/lib/utils/constants';
import { xProfileUrl } from '@/lib/utils/xSearch';
import type { PulseTokenBundle } from '@/types/tokens';

const BORDER = '#1b1f2a';
const PANEL = '#0c0f14';
const TRACK_TABS = [
  { id: 'x_feed' as const, label: 'X Feed' },
  { id: 'handles' as const, label: 'Handles' },
  { id: 'alert_rules' as const, label: 'Alerts' },
  { id: 'auto_buy' as const, label: 'Auto-Buy Rules' },
  { id: 'auto_launch' as const, label: 'Auto-Launch Rules' },
  { id: 'history' as const, label: 'History' },
  { id: 'settings' as const, label: 'Settings' },
];

type TrackTabId = (typeof TRACK_TABS)[number]['id'];

/** Pull a thin slice of Pulse so simulate + highlight approximate live rows. */
function usePulseSample(chain: string) {
  const col: PulseColumnId = 'new';
  return useQuery({
    queryKey: ['pulse', col, chain, 'track-sample'],
    queryFn: async (): Promise<PulseTokenBundle[]> => {
      const res = await fetch(`/api/tokens/feed?column=${col}&chain=${encodeURIComponent(chain)}`);
      if (!res.ok) return [];
      const j = (await res.json()) as { items: PulseTokenBundle[] };
      return j.items ?? [];
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function TrackOperatingSystem({
  kolHandlesPreview,
}: {
  kolHandlesPreview: KolHandleRow[];
}) {
  const activeChain = useUIStore((s) => s.activeChain);
  const tabState = useState<TrackTabId>('x_feed');
  const tab = tabState[0];
  const setTab = tabState[1];

  const global = useTrackAutomationStore((s) => s.global);
  const rules = useTrackAutomationStore((s) => s.rules);
  const history = useTrackAutomationStore((s) => s.history);
  const bootstrapIfEmpty = useTrackAutomationStore((s) => s.bootstrapIfEmpty);
  const setGlobalPatch = useTrackAutomationStore((s) => s.setGlobalPatch);
  const upsertRule = useTrackAutomationStore((s) => s.upsertRule);
  const removeRule = useTrackAutomationStore((s) => s.removeRule);
  const simulateTweet = useTrackAutomationStore((s) => s.simulateTweet);
  const purgeHistory = useTrackAutomationStore((s) => s.purgeHistory);
  const flashMint = useUIStore((s) => s.flashTrackPulseMint);

  const pulseQ = usePulseSample(activeChain);
  const pulseBundles = pulseQ.data ?? [];

  const [simHandle, setSimHandle] = useState('@ansem');
  const [simTweet, setSimTweet] = useState('just launched — CA below 👇 DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 pump.fun/next');

  const [builder, setBuilder] = useState<Partial<StoredAutomationRule> | null>(null);

  useEffect(() => {
    bootstrapIfEmpty(activeChain);
  }, [activeChain, bootstrapIfEmpty]);

  const filteredRules = useMemo(() => {
    if (tab === 'alert_rules') return rules.filter((r) => r.category === 'alert');
    if (tab === 'auto_buy') return rules.filter((r) => r.category === 'auto_buy');
    if (tab === 'auto_launch') return rules.filter((r) => r.category === 'auto_launch');
    return rules;
  }, [rules, tab]);

  const startNewRuleTemplate = useCallback(
    (cat: StoredAutomationRule['category']) => {
      const iso = new Date().toISOString();
      const base: StoredAutomationRule = {
        id: nanoid(),
        category: cat,
        name: cat === 'auto_buy' ? 'New auto-buy rule' : cat === 'auto_launch' ? 'New auto-launch rule' : 'New alert rule',
        enabled: false,
        createdAtIso: iso,
        updatedAtIso: iso,
        handles: [],
        chainHint: activeChain,
        triggersEnabled: cloneTriggers(),
        executionMode:
          cat === 'alert'
            ? 'alert_only'
            : cat === 'auto_buy'
              ? 'auto_buy'
              : 'one_click',
        executionTiming: 'precheck_then_buy',
        riskMode: 'strict',
        failureHandling: 'alert_only_after_failure',
        buySizeSol: cat === 'alert' ? null : 0.25,
        slippageBps: cat === 'auto_buy' ? 1200 : 800,
        priorityFeeLamports: null,
        maxMarketCapUsd: cat === 'auto_buy' ? 800_000 : null,
        minLiquidityUsdRule: cat === 'auto_buy' ? 3000 : null,
        cooldownMs: 120_000,
        maxBuysPerHour: cat === 'auto_buy' ? 3 : undefined,
        maxBuysPerDay: cat === 'auto_buy' ? 12 : undefined,
        keywords: [],
        keywordMatch: 'substring',
        semanticIntentHints: [],
        fixedMintCa: null,
        tickerSymbol: null,
        execWallet: { kind: 'active_primary' },
        riskPrefs: {
          minLiquidityUsd: 2000,
          holderCountMin: 15,
          bundleRugCheck: true,
          mintRevoked: true,
          freezeRevoked: true,
          lpBondingStatusOk: true,
          duplicateDetection: true,
          deployerBlacklist: true,
          knownScamDeployer: true,
          honeypotRoutingCheck: true,
          maxTaxBps: 1400,
          topHolderConcentrationMax: 0.46,
          newDeployerWarning: true,
        },
      };
      setBuilder(base);
    },
    [activeChain],
  );

  function runSimulator() {
    const ev = {
      id: `sim_${Date.now()}`,
      handle: simHandle,
      text: simTweet,
      urls: [],
      tweetUrl: 'https://x.com/i/simulation',
      createdAtIso: new Date().toISOString(),
    };
    const rows = simulateTweet(ev, pulseBundles);
    rows.forEach((r) =>
      toast.info(r.ruleName ?? 'Rule matched', {
        description: `${r.detectedMint ? `${shortenMint(r.detectedMint)} · ` : ''}${(r.aiConfidence01 * 100).toFixed(0)}% parse score`,
      }),
    );
    if (!rows.length) {
      toast.message('No rules matched toggles/handles.', {
        description: 'Tune triggers or widen the handle roster.',
      });
    }
    const mintHit = rows.find((r) => r.detectedMint)?.detectedMint;
    if (mintHit) {
      flashMint(mintHit);
      toast.success('Highlighted matching mint on Pulse (if visible in New lane).');
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 text-[12px]" style={{ color: '#e5e7eb' }}>
      <header
        className="flex shrink-0 flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-3"
        style={{ borderColor: BORDER, backgroundColor: '#0b1018' }}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
              <Radar className="h-3 w-3" strokeWidth={2} aria-hidden /> Track
            </span>
            {global.killSwitchActive ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-100">
                <ShieldAlert className="h-3 w-3" strokeWidth={2} aria-hidden /> Automation paused
              </span>
            ) : null}
          </div>
          <h1 className="text-[18px] font-semibold tracking-tight text-white">Trading trigger engine</h1>
          <p className="max-w-xl text-[12px] text-[#8b929e]">
            Monitor X handles you trust and fire alerts—or staged execution—when their posts match your rules.
          </p>
          <p className="max-w-xl pt-1 text-[11px] leading-relaxed text-[#6d7482]">
            Alerts default to the safest path. Auto-buy and auto-launch stay off until you enable them explicitly.
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/pulse"
            prefetch
            className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-[#dbeafe] hover:border-white/20 hover:text-white"
          >
            Open Pulse
          </Link>
          <Link
            href="/wallets"
            prefetch
            className="rounded-md border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-[#dbeafe] hover:border-white/20 hover:bg-white/[0.04]"
          >
            Wallet trackers
          </Link>
        </div>
      </header>

      <div
        className="flex min-h-[520px] min-w-0 flex-1 shrink-0 flex-col gap-2 lg:flex-row"
        style={{ backgroundColor: PANEL }}
      >
        {/* Main rail */}
        <div
          className="flex min-h-0 min-w-0 flex-[1.6] flex-col overflow-hidden rounded-lg border lg:rounded-r-none lg:border-r-0"
          style={{ borderColor: BORDER }}
        >
          <div className="flex flex-wrap gap-0 border-b px-2" style={{ borderColor: BORDER, backgroundColor: '#080d14' }}>
            {TRACK_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'whitespace-nowrap border-b-[2px] px-3 py-2 text-[11px] font-semibold transition',
                  tab === t.id
                    ? '-mb-[1px] border-signal-info text-white'
                    : 'border-transparent text-[#6b7280] hover:text-[#dbeafe]',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-3">
            {tab === 'x_feed' ? (
              <div className="space-y-3">
                <p className="text-[13px] leading-snug text-[#9ca3af]">
                  Live feed ingestion is staged. Use the simulator to rehearse parsing, Pulse highlights, and history lines.
                  Fast timings buy first and finish risk scans after; conservative modes gate execution or stay alert-only.
                </p>
                <SimulatorPanel
                  activeChain={activeChain}
                  simHandle={simHandle}
                  simTweet={simTweet}
                  onHandle={setSimHandle}
                  onTweet={setSimTweet}
                  pulseLoading={pulseQ.isLoading}
                  pulseRows={pulseBundles.length}
                  onRun={runSimulator}
                />
              </div>
            ) : null}

            {tab === 'handles' ? (
              <HandlesTable
                kolHandlesPreview={kolHandlesPreview}
                onOpenProfile={(h) => window.open(xProfileUrl(h), '_blank', 'noopener,noreferrer')}
              />
            ) : null}

            {tab === 'history' ? (
              <HistoryTable history={history} onClear={() => purgeHistory()} />
            ) : null}

            {tab === 'settings' ? (
              <SettingsPanel global={global} setGlobalPatch={setGlobalPatch} />
            ) : null}

            {tab === 'alert_rules' || tab === 'auto_buy' || tab === 'auto_launch' ? (
              <RulesTable
                tab={tab}
                rules={filteredRules}
                onEdit={(rule) => setBuilder(rule)}
                onRemove={(id) => removeRule(id)}
                onDuplicate={(rule) =>
                  upsertRule({
                    ...rule,
                    id: nanoid(),
                    name: `${rule.name} (copy)`,
                    enabled: false,
                    updatedAtIso: new Date().toISOString(),
                  })
                }
              />
            ) : null}
          </div>
        </div>

        {/* Rule builder */}
        <aside
          className="flex min-h-0 max-w-xl flex-[0.95] shrink-0 flex-col overflow-auto rounded-lg border lg:rounded-l-none"
          style={{ borderColor: BORDER, backgroundColor: '#10141f' }}
        >
          <div className="border-b px-3 py-2" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-2 text-[12px] font-semibold text-white">
              <Layers className="h-4 w-4 text-accent-primary" strokeWidth={2} aria-hidden />
              Rule builder
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[#7b8494]">
              Attach handles, choose triggers and execution posture, cooldowns, and wallet routing. Production swaps remain behind explicit confirmations.
            </p>
          </div>
          <div className="space-y-2 p-3">
            {!builder ? (
              <EmptyBuilder
                onNewAlert={() => startNewRuleTemplate('alert')}
                onNewBuy={() => startNewRuleTemplate('auto_buy')}
                onNewLaunch={() => startNewRuleTemplate('auto_launch')}
              />
            ) : (
              <RuleDraftForm rule={builder} onChange={(p) => setBuilder((prev) => ({ ...prev, ...p }) as StoredAutomationRule)} />
            )}
            <div className="flex gap-2">
              {!builder ? null : (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      upsertRule({
                        ...(builder as StoredAutomationRule),
                        updatedAtIso: new Date().toISOString(),
                      })
                    }
                    disabled={!(builder.name && builder.id)}
                    className="flex-1 rounded-md bg-accent-primary px-3 py-2 text-[11px] font-semibold text-fg-inverse hover:brightness-110 disabled:opacity-50"
                  >
                    Save locally
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuilder(null)}
                    className="rounded-md border border-white/15 px-3 py-2 text-[11px] font-semibold text-[#cfe2ff]"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function shortenMint(s: string) {
  if (s.length < 14) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function shortenWallet(addr: string) {
  if (addr.length < 13) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function SimulatorPanel(props: {
  activeChain: string;
  simHandle: string;
  simTweet: string;
  onHandle: (s: string) => void;
  onTweet: (s: string) => void;
  pulseLoading: boolean;
  pulseRows: number;
  onRun: () => void;
}) {
  return (
    <section className="space-y-2 rounded-lg border p-3" style={{ borderColor: BORDER, backgroundColor: '#0f131c' }}>
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <div className="text-[13px] font-semibold text-white">Simulator · {props.activeChain.toUpperCase()}</div>
          <div className="text-[11px] text-[#718096]">
            {props.pulseLoading ? 'Loading Pulse sample…' : `${props.pulseRows} live rows cached for mint matching`}
          </div>
        </div>
        <button
          type="button"
          className="rounded-md bg-emerald-500/90 px-3 py-1.5 text-[11px] font-semibold text-[#08110c] hover:bg-emerald-400"
          onClick={props.onRun}
        >
          Run simulation
        </button>
      </div>
      <label className="block space-y-1">
        <span className="text-[10px] font-medium tracking-tight text-[#8892a8]">Handle</span>
        <input
          value={props.simHandle}
          onChange={(e) => props.onHandle(e.target.value)}
          className="w-full rounded-md border border-white/10 bg-[#0b0f17] px-2 py-1.5 text-[12px] text-white outline-none focus:ring-1 focus:ring-emerald-500/70"
          placeholder="@handle"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[10px] font-medium tracking-tight text-[#8892a8]">Tweet</span>
        <textarea
          value={props.simTweet}
          onChange={(e) => props.onTweet(e.target.value)}
          rows={4}
          className="w-full resize-none rounded-md border border-white/10 bg-[#0b0f17] px-2 py-1.5 text-[12px] text-white outline-none focus:ring-1 focus:ring-emerald-500/70"
          placeholder="$TICK CA pump.fun/…"
        />
      </label>
    </section>
  );
}

function HandlesTable(props: {
  kolHandlesPreview: KolHandleRow[];
  onOpenProfile: (handle: string) => void;
}) {
  const { kolHandlesPreview, onOpenProfile } = props;
  const [find, setFind] = useState('');
  const rows = kolHandlesPreview.filter((r) => {
    const q = find.trim().replace(/^@/, '').toLowerCase();
    if (!q) return true;
    return (
      normalizeXHandle(r.handle).includes(q) ||
      normalizeXHandle(r.name).includes(q)
    );
  });

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          value={find}
          onChange={(e) => setFind(e.target.value)}
          placeholder="Find handle..."
          className="min-w-[200px] flex-1 rounded-md border border-white/10 bg-[#080d14] px-3 py-1.5 text-[12px] text-white outline-none focus:ring-1 focus:ring-signal-info/70"
        />
      </div>
      <table className="w-full overflow-hidden rounded-md border border-white/10 text-left text-[11px]">
        <thead className="bg-white/[0.04] tracking-tight text-[#8b929e]" style={{ fontSize: '10px' }}>
          <tr className="border-b border-white/10">
            <th className="px-3 py-2 font-semibold">Handle</th>
            <th className="hidden px-2 py-2 font-semibold sm:table-cell">Label</th>
            <th className="px-3 py-2 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-3 py-12 text-center text-[#677386]">
                No handles listed yet — add wallets with X profiles from Trackers or paste handles straight into rules.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={r.id} className={cn('border-t border-white/5', i % 2 === 0 ? 'bg-[#090d13]' : 'bg-[#0d1119]')}>
                <td className="max-w-[12rem] px-3 py-2 align-middle font-semibold text-white">
                  <button
                    type="button"
                    onClick={() => onOpenProfile(r.handle)}
                    className="truncate text-[#cfe2ff] hover:text-white hover:underline"
                  >
                    {r.handle.startsWith('@') ? r.handle : `@${r.handle}`}
                  </button>
                  <div className="mt-1 text-[10px] tabular-nums tracking-tight text-[#5c6575]">{shortenWallet(r.wallet)}</div>
                </td>
                <td className="hidden px-2 py-2 align-middle text-[#9ca3af] sm:table-cell">{r.name}</td>
                <td className="px-3 py-2 align-middle text-right">
                  <a
                    href={xProfileUrl(r.handle)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[10px] font-semibold text-[#b8cce8] hover:border-white/20"
                  >
                    X <ExternalLink className="h-3 w-3" aria-hidden strokeWidth={2} />
                  </a>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

function HistoryTable({
  history,
  onClear,
}: {
  history: AutomationHistoryEntry[];
  onClear: () => void;
}) {
  const [fq, setFq] = useState('');
  const filtered = useMemo(() => {
    const qq = fq.trim().toLowerCase();
    if (!qq) return history;
    return history.filter(
      (h) =>
        h.handle.toLowerCase().includes(qq) ||
        h.tweetSnippet.toLowerCase().includes(qq) ||
        (h.detectedMint?.toLowerCase().includes(qq) ?? false) ||
        (h.ruleName?.toLowerCase().includes(qq) ?? false),
    );
  }, [history, fq]);

  return (
    <section className="space-y-2">
      <div className="flex gap-2">
        <History className="h-5 w-5 text-accent-primary/80" strokeWidth={2} aria-hidden />
        <input
          value={fq}
          onChange={(e) => setFq(e.target.value)}
          className="min-w-[200px] flex-1 rounded-md border border-white/10 bg-[#090d13] px-3 py-1.5 text-[12px] text-white outline-none focus:ring-1 focus:ring-accent-primary/40"
          placeholder="Filter handle · mint · rule…"
        />
        <button
          type="button"
          onClick={onClear}
          disabled={history.length === 0}
          className="rounded-md border border-white/10 px-2 py-1.5 text-[11px] font-semibold text-[#f5b5b8] hover:border-white/20 disabled:opacity-40"
        >
          Clear
        </button>
      </div>
      <div className="max-h-[55vh] overflow-auto rounded-lg border border-white/10 bg-[#0b0f17]">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 z-[1] border-b border-white/10 bg-[#111621] tracking-tight text-[#8490a8]" style={{ fontSize: '10px' }}>
            <tr>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Time</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Handle</th>
              <th className="min-w-[8rem] px-3 py-2 font-semibold">Tweet</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Mint</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Confidence</th>
              <th className="whitespace-nowrap px-3 py-2 font-semibold">Result</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-[#738091]">
                  No automation events yet — run a simulation or wait for live ingest.
                </td>
              </tr>
            ) : (
              filtered.map((h) => (
                <tr key={h.id} className="border-t border-white/[0.04] hover:bg-white/[0.015]">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-[#8b969f]">{new Date(h.atIso).toLocaleString()}</td>
                  <td className="text-[11px] text-[#cce5ff]">@{normalizeXHandle(h.handle)}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-[11px]" title={h.tweetSnippet}>{h.tweetSnippet}</td>
                  <td className="tabular-nums text-[11px]" title={h.detectedMint ?? ''}>
                    {h.detectedMint ? shortenMint(h.detectedMint) : '—'}
                  </td>
                  <td className="whitespace-nowrap tabular-nums text-[11px]">{(h.aiConfidence01 * 100).toFixed(0)}%</td>
                  <td className="whitespace-nowrap">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', h.result === 'ok' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/12 text-amber-100')}>
                      {h.result}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SettingsPanel(props: {
  global: AutomationGlobalSettings;
  setGlobalPatch: (p: Partial<AutomationGlobalSettings>) => void;
}) {
  const { global, setGlobalPatch } = props;

  return (
    <div className="space-y-4">
      <ToggleRow title="Pause all automation" active={global.killSwitchActive} onToggle={() => setGlobalPatch({ killSwitchActive: !global.killSwitchActive })} />
      <ToggleRow title="Automation master (syncs when server rollout matches)" active={global.automationEnabledUi} onToggle={() => setGlobalPatch({ automationEnabledUi: !global.automationEnabledUi })} />
      <p className="text-[11px] leading-relaxed text-[#8490a8]">
        Per-trade caps, daily loss limits, cooldowns per handle or mint, and execution logs apply here once account sync ships. Until then these values tune previews only.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <NumericField label="Max SOL per trade" value={global.maxSolPerTrade} on={(n) => setGlobalPatch({ maxSolPerTrade: n })} />
        <NumericField label="Max SOL per day" value={global.maxSolPerDay} on={(n) => setGlobalPatch({ maxSolPerDay: n })} />
      </div>
    </div>
  );
}

function ToggleRow(props: { title: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onToggle}
      className="flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 transition hover:bg-white/[0.03]"
      style={{ borderColor: BORDER }}
    >
      <span className="text-left font-semibold text-white">{props.title}</span>
      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', props.active ? 'bg-emerald-500/25 text-emerald-100' : 'bg-[#1c2234] text-[#8f9bb8]')}>
        {props.active ? 'On' : 'Off'}
      </span>
    </button>
  );
}

function NumericField(props: {
  label: string;
  value: number | null;
  on: (next: number | null) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] text-[#8c97ad]">{props.label}</span>
      <input
        inputMode="decimal"
        value={props.value ?? ''}
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (!raw) return props.on(null);
          const n = Number(raw);
          if (Number.isFinite(n)) props.on(n);
        }}
        placeholder="Unset"
        className="w-full rounded-md border border-white/12 bg-[#080d14] px-3 py-1.5 tabular-nums text-[13px] text-white outline-none focus:ring-1 focus:ring-accent-primary/50"
      />
    </label>
  );
}

function RulesTable(props: {
  tab: Exclude<TrackTabId, 'x_feed' | 'handles' | 'history' | 'settings'>;
  rules: StoredAutomationRule[];
  onEdit: (r: StoredAutomationRule) => void;
  onRemove: (id: string) => void;
  onDuplicate: (r: StoredAutomationRule) => void;
}) {
  if (props.rules.length === 0) {
    return (
      <div className="rounded-lg border px-6 py-10 text-center text-[12px] leading-relaxed text-[#7c8796]" style={{ borderColor: BORDER }}>
        No rules in this lane yet — start from the rule builder.
      </div>
    );
  }
  return (
    <table className="w-full rounded-lg border text-left text-[11px]" style={{ borderColor: BORDER }}>
      <thead className="sticky top-0 z-[2] tracking-tight" style={{ backgroundColor: '#0f1420', color: '#7e8b9f', fontSize: '10px' }}>
        <tr className="border-b" style={{ borderColor: BORDER }}>
          <th className="px-3 py-2 font-semibold">Rule</th>
          <th className="px-3 py-2 font-semibold">Handles</th>
          <th className="hidden px-2 py-2 font-semibold md:table-cell">Mode</th>
          <th className="hidden px-2 py-2 font-semibold lg:table-cell">Buy</th>
          <th className="px-3 py-2 font-semibold">Status</th>
          <th className="px-3 py-2 text-right font-semibold">Edit</th>
        </tr>
      </thead>
      <tbody>
        {props.rules.map((rule, ix) => (
          <tr key={rule.id} className="border-t" style={{ borderColor: BORDER, backgroundColor: ix % 2 === 0 ? '#0a0e15' : '#0d121a' }}>
            <td className="px-3 py-2">
              <div className="font-semibold text-white">{rule.name}</div>
              <div className="text-[10px] text-[#6d7788] capitalize">{rule.category.replace('_', ' ')} · {rule.riskMode} risk lane</div>
            </td>
            <td className="max-w-[8rem] px-3 py-2 text-[#b7cfff]">{rule.handles.length ? rule.handles.map((h) => `@${normalizeXHandle(h)}`).join(', ') : 'All (empty roster)'}</td>
            <td className="hidden px-2 py-2 text-[11px] text-[#9fb4d9] capitalize md:table-cell">{rule.executionMode.replace('_', ' ')}</td>
            <td className="hidden px-2 py-2 lg:table-cell">
              <span className="tabular-nums text-[11px] text-[#cae6ff]">
                {rule.buySizeSol != null ? `${rule.buySizeSol} SOL` : '—'}
              </span>
            </td>
            <td className="px-3 py-2">
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', rule.enabled ? 'bg-emerald-500/22 text-emerald-100' : 'bg-[#1d2237] text-[#8490a8]')}>
                {rule.enabled ? 'Active' : 'Disabled'}
              </span>
            </td>
            <td className="space-x-2 px-3 py-2 text-right">
              <button type="button" onClick={() => props.onEdit(rule)} className="font-semibold text-[#cfe2ff] hover:underline">
                Edit
              </button>
              <button type="button" onClick={() => props.onDuplicate(rule)} className="text-[#aab8d9] hover:underline">
                Copy
              </button>
              <button type="button" className="text-[#fca5a5] hover:underline" onClick={() => props.onRemove(rule.id)}>
                Remove
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EmptyBuilder(props: { onNewAlert: () => void; onNewBuy: () => void; onNewLaunch: () => void }) {
  return (
    <div className="space-y-2 rounded-lg border border-dashed border-white/10 p-6 text-[12px] text-[#7e8ea2]">
      <p className="font-medium text-[#9fb0c4]">Pick a template:</p>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={props.onNewAlert} className="rounded-md border border-white/10 px-4 py-2 text-left text-[11px] font-semibold text-white hover:bg-white/[0.04]">
          Alerts only — toasts and sounds, no execution
        </button>
        <button type="button" onClick={props.onNewBuy} className="rounded-md border border-white/15 px-4 py-2 text-left text-[11px] font-semibold text-[#c7daf7] hover:bg-white/[0.04]">
          Auto-buy preset — killswitch-gated, CA confidence checks on
        </button>
        <button type="button" onClick={props.onNewLaunch} className="rounded-md border border-white/15 px-4 py-2 text-left text-[11px] font-semibold text-[#c7daf7] hover:bg-white/[0.04]">
          Launch watcher — bonding curve and fresh-deploy filters
        </button>
      </div>
      <p className="text-[11px] leading-snug text-[#8490a8]">
        Execution uses your <strong className="text-white">primary wallet</strong> unless a per-rule wallet is set. Pointer never stores private keys in this panel.
      </p>
    </div>
  );
}

function RuleDraftForm(props: {
  rule: Partial<StoredAutomationRule>;
  onChange: (p: Partial<StoredAutomationRule>) => void;
}) {
  const { rule, onChange } = props;
  const t = rule.triggersEnabled ?? cloneTriggers();

  return (
    <div className="space-y-4 text-[12px]">
      <label className="space-y-1">
        <div className="text-[11px] text-[#8c94a9]">Name</div>
        <input value={rule.name ?? ''} onChange={(e) => onChange({ name: e.target.value })} className="w-full rounded-md border border-white/10 bg-[#0b0f17] px-3 py-1.5 text-white outline-none focus:ring-1 focus:ring-accent-primary/50" />
      </label>

      <label className="space-y-1">
        <div className="text-[11px] text-[#8c94a9]">Handles (@ optional, newline or comma-separated)</div>
        <textarea
          value={(rule.handles ?? []).join('\n')}
          onChange={(e) =>
            onChange({
              handles: e.target.value
                .split(/[\n,]+/)
                .map((s) => normalizeXHandle(s))
                .filter(Boolean),
            })
          }
          rows={3}
          className="w-full rounded-md border border-white/12 bg-[#0b0f17] px-3 py-1.5 text-white outline-none focus:ring-1 focus:ring-accent-primary/50"
        />
      </label>

      <div className="space-y-1">
        <div className="text-[11px] text-[#8c94a9]">Trigger toggles</div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {(Object.entries(t) as [AutomationTriggerType, boolean][]).map(([k, v]) => (
            <label key={String(k)} className="flex cursor-pointer justify-between rounded border border-transparent px-1 py-0.5 text-[11px] hover:bg-white/[0.03]">
              <span className="text-[#cdd7ef] capitalize">{triggerLabel(k)}</span>
              <input
                type="checkbox"
                checked={v}
                onChange={(e) => onChange({ triggersEnabled: { ...t, [k]: e.target.checked } })}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[11px] text-[#8892aa]">Mode</span>
          <select
            value={rule.executionMode ?? 'alert_only'}
            onChange={(e) => onChange({ executionMode: e.target.value as StoredAutomationRule['executionMode'] })}
            className="w-full rounded-md border border-white/10 bg-[#0b0f17] px-2 py-2 text-[12px]"
          >
            <option value="alert_only">Alert only</option>
            <option value="one_click">One-click buy</option>
            <option value="auto_buy">Full auto-buy</option>
          </select>
          {rule.executionMode === 'auto_buy' ? (
            <p className="mt-1 text-[11px] text-[#fcd34d]/90">Dangerous lane — requires killswitch cleared + automation master + confirmations server-side.</p>
          ) : null}
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-[#8892aa]">Timing</span>
          <select
            value={rule.executionTiming ?? 'precheck_then_buy'}
            onChange={(e) => onChange({ executionTiming: e.target.value as StoredAutomationRule['executionTiming'] })}
            className="w-full rounded-md border border-white/12 bg-[#0b0f17] px-2 py-2 text-[12px]"
          >
            <option value="precheck_then_buy">Fast pre-check, then buy</option>
            <option value="instant_then_scan">Instant buy first, scan after</option>
          </select>
          {rule.executionTiming === 'instant_then_scan' ? (
            <p className="mt-1 text-[11px] text-[#facc15]/90">
              Instant mode prioritizes speed. Risk checks may complete after execution.
            </p>
          ) : null}
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="text-[11px] text-[#8892aa]">Buy size (SOL)</span>
          <input
            value={rule.buySizeSol ?? ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === '') {
                onChange({ buySizeSol: null });
                return;
              }
              const n = Number(raw);
              if (!Number.isFinite(n)) return;
              onChange({ buySizeSol: n });
            }}
            className="w-full rounded-md border border-white/10 bg-[#0b0f17] px-2 py-1.5 text-[12px] text-white"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-[#8892aa]">Slippage bps</span>
          <input
            type="number"
            value={rule.slippageBps ?? ''}
            onChange={(e) =>
              onChange({
                slippageBps: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="w-full rounded-md border border-white/10 bg-[#0b0f17] px-2 py-1.5 text-[12px]"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-[#8892aa]">Fixed mint CA (optional)</span>
          <input
            value={rule.fixedMintCa ?? ''}
            onChange={(e) => onChange({ fixedMintCa: e.target.value.trim() || null })}
            className="w-full rounded-md border border-white/10 bg-[#0b0f17] px-2 py-1.5 tabular-nums text-[11px] tracking-tight text-white"
          />
        </label>
      </div>

      <label className="space-y-1">
        <span className="text-[11px] text-[#8892aa]">Keywords (comma)</span>
        <input value={(rule.keywords ?? []).join(', ')} onChange={(e) => onChange({ keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} className="w-full rounded-md border border-white/12 bg-[#0b0f17] px-2 py-1.5" />
      </label>

      <label className="inline-flex gap-3 text-[11px] text-[#cdd7ef]">
        <input type="checkbox" checked={rule.enabled ?? false} onChange={(e) => onChange({ enabled: e.target.checked })} />
        Rule enabled locally
      </label>
    </div>
  );
}

function triggerLabel(k: AutomationTriggerType): string {
  switch (k) {
    case 'tweet_from_handle':
      return 'Tweet from handle';
    case 'contains_contract_address':
      return 'Contract address';
    case 'contains_ticker':
      return 'Ticker / symbol';
    case 'launch_link':
      return 'Launch link';
    case 'keywords':
      return 'Configured keywords';
    case 'ai_semantic_intent':
      return 'Semantic intent';
    case 'pulse_visible_token':
      return 'Matched Pulse mint';
    case 'fresh_launch_style':
      return 'Fresh launch phrasing';
    default:
      return String(k);
  }
}
