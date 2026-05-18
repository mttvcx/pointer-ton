'use client';

import Link from 'next/link';
import { nanoid } from 'nanoid';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BellRing,
  ChevronRight,
  Cpu,
  ExternalLink,
  HistoryIcon,
  Layers,
  Plus,
  Power,
  Radar,
  RefreshCcw,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
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
import { fetchPulseFeedBundles } from '@/lib/tokens/fetchPulseFeedClient';
import type { PulseTokenBundle } from '@/types/tokens';

/**
 * Track / "Trading trigger engine" — Task TR2 revamp.
 *
 * Visual model: a single elevated *grey plate* (`bg-bg-hover`) holds the entire
 * workspace, with content sections inset on the page's `bg-bg-base`. That gives
 * the Axiom-style "terminal" depth without resorting to a wall of outlined
 * cards on a dark page (which was the prior shell). Status, tabs, KPIs, and
 * primary actions all live in one thin top strip so the body is mostly content.
 *
 * No theme is hardcoded — everything resolves through Tailwind tokens
 * (`bg-bg-*`, `text-fg-*`, `text-signal-*`, `border-border-subtle`, etc).
 */

const TRACK_TABS = [
  { id: 'x_feed' as const, label: 'Engine', icon: Cpu },
  { id: 'handles' as const, label: 'Handles', icon: Radar },
  { id: 'alert_rules' as const, label: 'Alerts', icon: BellRing },
  { id: 'auto_buy' as const, label: 'Auto-Buy', icon: Zap },
  { id: 'auto_launch' as const, label: 'Launch', icon: Sparkles },
  { id: 'history' as const, label: 'History', icon: HistoryIcon },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
];

type TrackTabId = (typeof TRACK_TABS)[number]['id'];

type EngineTone = 'bull' | 'warn' | 'bear';

function usePulseSample(chain: string) {
  const col: PulseColumnId = 'new';
  return useQuery({
    queryKey: ['pulse', col, chain, 'track-sample'],
    queryFn: async (): Promise<PulseTokenBundle[]> => {
      try {
        return await fetchPulseFeedBundles(col, chain);
      } catch {
        return [];
      }
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
  const [tab, setTab] = useState<TrackTabId>('x_feed');

  const global = useTrackAutomationStore((s) => s.global);
  const rules = useTrackAutomationStore((s) => s.rules);
  const history = useTrackAutomationStore((s) => s.history);
  const bootstrapIfEmpty = useTrackAutomationStore((s) => s.bootstrapIfEmpty);
  const setGlobalPatch = useTrackAutomationStore((s) => s.setGlobalPatch);
  const upsertRule = useTrackAutomationStore((s) => s.upsertRule);
  const removeRule = useTrackAutomationStore((s) => s.removeRule);
  const purgeHistory = useTrackAutomationStore((s) => s.purgeHistory);

  const pulseQ = usePulseSample(activeChain);
  const pulseBundles = useMemo(() => pulseQ.data ?? [], [pulseQ.data]);

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

  const counts = useMemo(
    () => ({
      alert_rules: rules.filter((r) => r.category === 'alert').length,
      auto_buy: rules.filter((r) => r.category === 'auto_buy').length,
      auto_launch: rules.filter((r) => r.category === 'auto_launch').length,
      history: history.length,
    }),
    [rules, history],
  );

  const insights = useMemo(() => {
    const dayMs = 24 * 3600 * 1000;
    const cutoff = Date.now() - dayMs;
    const todays = history.filter((h) => new Date(h.atIso).getTime() > cutoff);
    const fires = todays.filter((h) => h.result === 'ok').length;
    const fails = todays.filter((h) => h.result === 'failed').length;
    const skipped = todays.filter((h) => h.result === 'skipped').length;
    const avgConf =
      todays.length > 0
        ? todays.reduce((sum, h) => sum + h.aiConfidence01, 0) / todays.length
        : 0;
    const handleTally = new Map<string, number>();
    for (const h of todays) {
      const k = normalizeXHandle(h.handle);
      if (!k) continue;
      handleTally.set(k, (handleTally.get(k) ?? 0) + 1);
    }
    const topHandle = Array.from(handleTally.entries()).sort((a, b) => b[1] - a[1])[0];
    const intentTally = new Map<string, number>();
    for (const h of todays) {
      const k = h.intentBucket ?? 'irrelevant';
      intentTally.set(k, (intentTally.get(k) ?? 0) + 1);
    }
    const topIntent = Array.from(intentTally.entries()).sort((a, b) => b[1] - a[1])[0];
    return {
      total: todays.length,
      fires,
      fails,
      skipped,
      avgConf,
      topHandle: topHandle ? { handle: topHandle[0], count: topHandle[1] } : null,
      topIntent: topIntent ? { bucket: topIntent[0], count: topIntent[1] } : null,
    };
  }, [history]);

  const engineState = useMemo<{ tone: EngineTone; label: string }>(() => {
    if (global.killSwitchActive) return { tone: 'bear', label: 'Killswitch' };
    if (!global.automationEnabledUi) return { tone: 'warn', label: 'Alerts only' };
    return { tone: 'bull', label: 'Live' };
  }, [global]);

  const startNewRuleTemplate = useCallback(
    (cat: StoredAutomationRule['category']) => {
      const iso = new Date().toISOString();
      const base: StoredAutomationRule = {
        id: nanoid(),
        category: cat,
        name:
          cat === 'auto_buy'
            ? 'New auto-buy rule'
            : cat === 'auto_launch'
              ? 'New auto-launch rule'
              : 'New alert rule',
        enabled: false,
        createdAtIso: iso,
        updatedAtIso: iso,
        handles: [],
        chainHint: activeChain,
        triggersEnabled: cloneTriggers(),
        executionMode:
          cat === 'alert' ? 'alert_only' : cat === 'auto_buy' ? 'auto_buy' : 'one_click',
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

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col text-fg-primary">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-hover shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset,0_8px_28px_-22px_rgba(0,0,0,0.65)]">
        <PlateHeader
          engineState={engineState}
          global={global}
          tab={tab}
          setTab={setTab}
          counts={counts}
          insights={insights}
          ruleCount={rules.length}
          enabledCount={enabledCount}
          onTogglePause={() => setGlobalPatch({ killSwitchActive: !global.killSwitchActive })}
          onToggleAutomationMaster={() =>
            setGlobalPatch({ automationEnabledUi: !global.automationEnabledUi })
          }
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden p-2 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
          <Pane>
            {tab === 'x_feed' ? (
              <EngineConsole
                activeChain={activeChain}
                pulseLoading={pulseQ.isLoading}
                pulseRows={pulseBundles.length}
              />
            ) : null}
            {tab === 'handles' ? (
              <HandlesPanel
                kolHandlesPreview={kolHandlesPreview}
                onOpenProfile={(h) =>
                  window.open(xProfileUrl(h), '_blank', 'noopener,noreferrer')
                }
              />
            ) : null}
            {tab === 'history' ? (
              <HistoryPanel history={history} onClear={() => purgeHistory()} />
            ) : null}
            {tab === 'settings' ? (
              <SettingsPanel global={global} setGlobalPatch={setGlobalPatch} />
            ) : null}
            {tab === 'alert_rules' || tab === 'auto_buy' || tab === 'auto_launch' ? (
              <RulesPanel
                tab={tab}
                rules={filteredRules}
                onNew={() =>
                  startNewRuleTemplate(
                    tab === 'alert_rules'
                      ? 'alert'
                      : tab === 'auto_buy'
                        ? 'auto_buy'
                        : 'auto_launch',
                  )
                }
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
          </Pane>

          <Pane>
            {builder ? (
              <RuleBuilderCard
                rule={builder}
                onChange={(p) =>
                  setBuilder((prev) => ({ ...prev, ...p }) as StoredAutomationRule)
                }
                onSave={() => {
                  if (!(builder.name && builder.id)) return;
                  upsertRule({
                    ...(builder as StoredAutomationRule),
                    updatedAtIso: new Date().toISOString(),
                  });
                  toast.success('Rule saved locally.');
                  setBuilder(null);
                }}
                onCancel={() => setBuilder(null)}
              />
            ) : (
              <SideInsights
                insights={insights}
                onNewAlert={() => startNewRuleTemplate('alert')}
                onNewBuy={() => startNewRuleTemplate('auto_buy')}
                onNewLaunch={() => startNewRuleTemplate('auto_launch')}
              />
            )}
          </Pane>
        </div>
      </div>
    </div>
  );
}

/* ---------- shared shells / helpers ---------- */

function Pane({ children }: { children: ReactNode }) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border-subtle bg-bg-base">
      {children}
    </section>
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

function toneText(tone: EngineTone) {
  return tone === 'bull'
    ? 'text-signal-bull'
    : tone === 'warn'
      ? 'text-signal-warn'
      : 'text-signal-bear';
}

function toneDot(tone: EngineTone) {
  return tone === 'bull'
    ? 'bg-signal-bull'
    : tone === 'warn'
      ? 'bg-signal-warn'
      : 'bg-signal-bear';
}

/* ---------- top plate header ---------- */

function PlateHeader({
  engineState,
  global,
  tab,
  setTab,
  counts,
  insights,
  ruleCount,
  enabledCount,
  onTogglePause,
  onToggleAutomationMaster,
}: {
  engineState: { tone: EngineTone; label: string };
  global: AutomationGlobalSettings;
  tab: TrackTabId;
  setTab: (id: TrackTabId) => void;
  counts: { alert_rules: number; auto_buy: number; auto_launch: number; history: number };
  insights: { total: number; avgConf: number; skipped: number };
  ruleCount: number;
  enabledCount: number;
  onTogglePause: () => void;
  onToggleAutomationMaster: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border-subtle px-2.5 py-1.5">
      {/* status pill */}
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-base px-2 py-1 text-[11px] font-semibold',
          toneText(engineState.tone),
        )}
        title="Engine state"
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            toneDot(engineState.tone),
            engineState.tone === 'bull' && 'animate-pulse-soft',
          )}
        />
        {engineState.label}
      </span>

      {/* tabs */}
      <div className="ml-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TRACK_TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          const count =
            t.id === 'alert_rules'
              ? counts.alert_rules
              : t.id === 'auto_buy'
                ? counts.auto_buy
                : t.id === 'auto_launch'
                  ? counts.auto_launch
                  : t.id === 'history'
                    ? counts.history
                    : null;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'btn-press inline-flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-[11px] font-semibold transition-colors',
                active
                  ? 'bg-bg-base text-fg-primary'
                  : 'text-fg-muted hover:bg-bg-base/60 hover:text-fg-primary',
              )}
            >
              <Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
              {t.label}
              {count != null && count > 0 ? (
                <span
                  className={cn(
                    'rounded px-1 py-px text-[9px] font-bold tabular-nums',
                    active ? 'bg-bg-hover text-fg-secondary' : 'bg-bg-base text-fg-muted',
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* inline KPI strip + actions */}
      <div className="flex shrink-0 items-center gap-2 text-[11px] text-fg-muted">
        <KpiInline
          items={[
            { label: '24h', value: insights.total.toLocaleString() },
            {
              label: 'conf',
              value: `${Math.round(insights.avgConf * 100)}%`,
              tone:
                insights.avgConf > 0.7
                  ? 'bull'
                  : insights.avgConf > 0.4
                    ? 'warn'
                    : undefined,
            },
            { label: 'rules', value: `${enabledCount}/${ruleCount}` },
            { label: 'skip', value: insights.skipped.toLocaleString() },
          ]}
        />
        <span className="h-4 w-px shrink-0 bg-border-subtle" aria-hidden />
        <HeaderIconButton
          onClick={onToggleAutomationMaster}
          tone={global.automationEnabledUi ? 'bull' : 'muted'}
          title={`Automation master · ${global.automationEnabledUi ? 'On' : 'Off'}`}
        >
          <Power className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </HeaderIconButton>
        <HeaderIconButton
          onClick={onTogglePause}
          tone={global.killSwitchActive ? 'bear' : 'muted'}
          title={global.killSwitchActive ? 'Clear killswitch' : 'Killswitch'}
        >
          <ShieldAlert className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </HeaderIconButton>
        <Link
          href="/pulse"
          prefetch
          className="btn-press inline-flex items-center gap-1 rounded border border-border-subtle bg-bg-base px-2 py-1 text-[11px] font-semibold text-fg-secondary hover:bg-bg-hover hover:text-fg-primary"
          title="Open Pulse"
        >
          Pulse
          <ChevronRight className="h-3 w-3" strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function KpiInline({
  items,
}: {
  items: { label: string; value: string; tone?: 'bull' | 'warn' | 'bear' }[];
}) {
  return (
    <div className="hidden items-center gap-2 md:flex">
      {items.map((it, i) => (
        <span key={`${it.label}-${i}`} className="inline-flex items-center gap-1 whitespace-nowrap">
          <span className="text-[10px] uppercase tracking-[0.12em] text-fg-muted">{it.label}</span>
          <span
            className={cn(
              'tabular-nums font-semibold',
              it.tone === 'bull'
                ? 'text-signal-bull'
                : it.tone === 'warn'
                  ? 'text-signal-warn'
                  : it.tone === 'bear'
                    ? 'text-signal-bear'
                    : 'text-fg-secondary',
            )}
          >
            {it.value}
          </span>
        </span>
      ))}
    </div>
  );
}

function HeaderIconButton({
  children,
  onClick,
  tone,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  tone: 'bull' | 'bear' | 'muted';
  title: string;
}) {
  const cls =
    tone === 'bull'
      ? 'border-signal-bull/40 bg-signal-bull/10 text-signal-bull hover:bg-signal-bull/20'
      : tone === 'bear'
        ? 'border-signal-bear/40 bg-signal-bear/10 text-signal-bear hover:bg-signal-bear/20'
        : 'border-border-subtle bg-bg-base text-fg-secondary hover:bg-bg-hover hover:text-fg-primary';
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        'btn-press inline-flex h-6 w-6 items-center justify-center rounded border transition-colors',
        cls,
      )}
    >
      {children}
    </button>
  );
}

/* ---------- engine console (x_feed tab) ---------- */

function EngineConsole(props: {
  activeChain: string;
  pulseLoading: boolean;
  pulseRows: number;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-3 py-2">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            X ingest
          </div>
          <div className="truncate text-[11px] text-fg-secondary">
            {props.activeChain.toUpperCase()} ·{' '}
            {props.pulseLoading
              ? 'loading sample…'
              : `${props.pulseRows.toLocaleString()} live rows cached for cross-check`}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4">
        <p className="text-[12px] leading-relaxed text-fg-secondary">
          Tracked tweets from your allow-listed accounts arrive here via the terminal ingest pipe. Rules
          run on those live posts only — no mocked “Run” previews.
        </p>
      </div>
    </div>
  );
}

/* ---------- handles tab ---------- */

function HandlesPanel({
  kolHandlesPreview,
  onOpenProfile,
}: {
  kolHandlesPreview: KolHandleRow[];
  onOpenProfile: (handle: string) => void;
}) {
  const [find, setFind] = useState('');
  const rows = kolHandlesPreview.filter((r) => {
    const q = find.trim().replace(/^@/, '').toLowerCase();
    if (!q) return true;
    return (
      normalizeXHandle(r.handle).includes(q) || normalizeXHandle(r.name).includes(q)
    );
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-3 py-2">
        <label className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted"
            strokeWidth={2}
            aria-hidden
          />
          <input
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="Find handle…"
            className="w-full rounded-md border border-border-subtle bg-bg-hover py-1.5 pl-7 pr-3 text-[12px] text-fg-primary outline-none transition focus:border-accent-primary/60 focus:ring-1 focus:ring-accent-primary/40"
          />
        </label>
        <span className="shrink-0 tabular-nums text-[11px] text-fg-muted">
          {rows.length} handles
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="sticky top-0 z-[1] border-b border-border-subtle bg-bg-base text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Handle</th>
              <th className="hidden px-3 py-2 font-semibold sm:table-cell">Label</th>
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-12 text-center text-[12px] text-fg-muted">
                  No handles yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-bg-hover">
                  <td className="max-w-[14rem] px-3 py-1.5 align-middle">
                    <button
                      type="button"
                      onClick={() => onOpenProfile(r.handle)}
                      className="truncate text-[12px] font-semibold text-fg-primary hover:text-accent-primary"
                    >
                      {r.handle.startsWith('@') ? r.handle : `@${r.handle}`}
                    </button>
                    <div className="mt-0.5 font-mono text-[10px] tabular-nums text-fg-muted">
                      {shortenWallet(r.wallet)}
                    </div>
                  </td>
                  <td className="hidden px-3 py-1.5 align-middle text-fg-secondary sm:table-cell">
                    {r.name}
                  </td>
                  <td className="px-3 py-1.5 align-middle text-right">
                    <a
                      href={xProfileUrl(r.handle)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 rounded border border-border-subtle bg-bg-hover px-2 py-1 text-[10px] font-semibold text-fg-secondary transition-colors hover:bg-bg-base hover:text-fg-primary"
                    >
                      X <ExternalLink className="h-3 w-3" aria-hidden strokeWidth={2} />
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- history tab ---------- */

type IntentTone = { label: string; tone: 'bull' | 'warn' | 'info' | 'muted' };
const FALLBACK_INTENT: IntentTone = { label: 'Noise', tone: 'muted' };
const INTENT_TONE: Record<string, IntentTone> = {
  token_call: { label: 'Token call', tone: 'bull' },
  launch_announcement: { label: 'Launch', tone: 'info' },
  news_catalyst: { label: 'News', tone: 'warn' },
  kol_signal: { label: 'KOL signal', tone: 'info' },
  irrelevant: FALLBACK_INTENT,
};
function intentFor(bucket: string | null | undefined): IntentTone {
  if (!bucket) return FALLBACK_INTENT;
  return INTENT_TONE[bucket] ?? FALLBACK_INTENT;
}
function intentBadgeCls(t: 'bull' | 'warn' | 'info' | 'muted'): string {
  switch (t) {
    case 'bull':
      return 'border-signal-bull/35 bg-signal-bull/10 text-signal-bull';
    case 'warn':
      return 'border-signal-warn/35 bg-signal-warn/10 text-signal-warn';
    case 'info':
      return 'border-signal-info/35 bg-signal-info/10 text-signal-info';
    default:
      return 'border-border-subtle bg-bg-hover text-fg-muted';
  }
}

function HistoryPanel({
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-3 py-2">
        <label className="relative min-w-[200px] flex-1">
          <HistoryIcon
            className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted"
            strokeWidth={2}
            aria-hidden
          />
          <input
            value={fq}
            onChange={(e) => setFq(e.target.value)}
            className="w-full rounded-md border border-border-subtle bg-bg-hover py-1.5 pl-7 pr-3 text-[12px] text-fg-primary outline-none transition focus:border-accent-primary/60 focus:ring-1 focus:ring-accent-primary/40"
            placeholder="Filter handle · mint · rule…"
          />
        </label>
        <button
          type="button"
          onClick={onClear}
          disabled={history.length === 0}
          className="btn-press inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-hover px-2.5 py-1.5 text-[11px] font-semibold text-fg-secondary transition-colors hover:bg-bg-base hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-3 w-3" strokeWidth={2} aria-hidden />
          Clear
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="sticky top-0 z-[1] border-b border-border-subtle bg-bg-base text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
            <tr>
              <th className="whitespace-nowrap px-3 py-2">Time</th>
              <th className="whitespace-nowrap px-3 py-2">Handle</th>
              <th className="min-w-[10rem] px-3 py-2">Tweet</th>
              <th className="whitespace-nowrap px-3 py-2">Mint</th>
              <th className="whitespace-nowrap px-3 py-2">Conf</th>
              <th className="whitespace-nowrap px-3 py-2">Intent</th>
              <th className="whitespace-nowrap px-3 py-2">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-12 text-center text-[12px] text-fg-muted">
                  No automation events yet.
                </td>
              </tr>
            ) : (
              filtered.map((h) => {
                const intent = intentFor(h.intentBucket);
                return (
                  <tr key={h.id} className="transition-colors hover:bg-bg-hover">
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-fg-muted">
                      {new Date(h.atIso).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-fg-primary">
                      @{normalizeXHandle(h.handle)}
                    </td>
                    <td
                      className="max-w-xs truncate px-3 py-1.5 text-fg-secondary"
                      title={h.tweetSnippet}
                    >
                      {h.tweetSnippet}
                    </td>
                    <td
                      className="whitespace-nowrap px-3 py-1.5 font-mono tabular-nums text-fg-primary"
                      title={h.detectedMint ?? ''}
                    >
                      {h.detectedMint ? shortenMint(h.detectedMint) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <div className="flex w-24 items-center gap-2">
                        <ConfidenceBar value01={h.aiConfidence01} />
                        <span className="shrink-0 tabular-nums text-[11px] text-fg-secondary">
                          {(h.aiConfidence01 * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                          intentBadgeCls(intent.tone),
                        )}
                      >
                        {intent.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <ResultPill result={h.result} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConfidenceBar({ value01, className }: { value01: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, value01)) * 100;
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-bg-hover', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-accent-primary via-accent-glow to-signal-bull"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ResultPill({ result }: { result: 'ok' | 'failed' | 'skipped' }) {
  const cls =
    result === 'ok'
      ? 'border-signal-bull/40 bg-signal-bull/12 text-signal-bull'
      : result === 'failed'
        ? 'border-signal-bear/40 bg-signal-bear/12 text-signal-bear'
        : 'border-border-subtle bg-bg-hover text-fg-muted';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
        cls,
      )}
    >
      {result}
    </span>
  );
}

/* ---------- settings tab ---------- */

function SettingsPanel(props: {
  global: AutomationGlobalSettings;
  setGlobalPatch: (p: Partial<AutomationGlobalSettings>) => void;
}) {
  const { global, setGlobalPatch } = props;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
      <div className="space-y-2">
        <ToggleRow
          title="Pause all automation"
          subtitle="Visible emergency stop. Blocks alerts + buys until cleared."
          active={global.killSwitchActive}
          tone="bear"
          onToggle={() => setGlobalPatch({ killSwitchActive: !global.killSwitchActive })}
        />
        <ToggleRow
          title="Automation master"
          subtitle="Server rollout-gated. Syncs with your account once enabled."
          active={global.automationEnabledUi}
          tone="bull"
          onToggle={() => setGlobalPatch({ automationEnabledUi: !global.automationEnabledUi })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <NumericField
          label="Max SOL · trade"
          value={global.maxSolPerTrade}
          on={(n) => setGlobalPatch({ maxSolPerTrade: n })}
        />
        <NumericField
          label="Max SOL · day"
          value={global.maxSolPerDay}
          on={(n) => setGlobalPatch({ maxSolPerDay: n })}
        />
      </div>
    </div>
  );
}

function ToggleRow(props: {
  title: string;
  subtitle: string;
  active: boolean;
  tone: 'bull' | 'bear';
  onToggle: () => void;
}) {
  const onCls =
    props.tone === 'bull'
      ? 'border-signal-bull/40 bg-signal-bull/10 text-signal-bull'
      : 'border-signal-bear/40 bg-signal-bear/10 text-signal-bear';
  return (
    <button
      type="button"
      onClick={props.onToggle}
      className="btn-press flex w-full items-center justify-between gap-3 rounded-md border border-border-subtle bg-bg-hover px-3 py-2 text-left transition-colors hover:bg-bg-base"
    >
      <div className="min-w-0 space-y-0.5">
        <div className="text-[12px] font-semibold text-fg-primary">{props.title}</div>
        <div className="text-[10px] text-fg-muted">{props.subtitle}</div>
      </div>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
          props.active ? onCls : 'border-border-subtle bg-bg-base text-fg-muted',
        )}
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            props.active
              ? props.tone === 'bull'
                ? 'bg-signal-bull'
                : 'bg-signal-bear'
              : 'bg-fg-muted',
          )}
        />
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
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
        {props.label}
      </span>
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
        className="w-full rounded-md border border-border-subtle bg-bg-hover px-3 py-1.5 text-[13px] tabular-nums text-fg-primary outline-none transition focus:border-accent-primary/60 focus:ring-1 focus:ring-accent-primary/40"
      />
    </label>
  );
}

/* ---------- rules tab ---------- */

function RulesPanel(props: {
  tab: Exclude<TrackTabId, 'x_feed' | 'handles' | 'history' | 'settings'>;
  rules: StoredAutomationRule[];
  onNew: () => void;
  onEdit: (r: StoredAutomationRule) => void;
  onRemove: (id: string) => void;
  onDuplicate: (r: StoredAutomationRule) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-subtle px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          {props.tab === 'alert_rules'
            ? 'Alert rules'
            : props.tab === 'auto_buy'
              ? 'Auto-buy rules'
              : 'Launch watcher rules'}
        </span>
        <button
          type="button"
          onClick={props.onNew}
          className="btn-press inline-flex items-center gap-1.5 rounded-md border border-accent-primary/40 bg-accent-primary/15 px-2.5 py-1 text-[11px] font-semibold text-accent-primary transition-colors hover:bg-accent-primary/25"
        >
          <Plus className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          New
        </button>
      </div>

      {props.rules.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-12 text-center text-[12px] text-fg-muted">
          No rules in this lane.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="sticky top-0 z-[1] border-b border-border-subtle bg-bg-base text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
              <tr>
                <th className="px-3 py-2">Rule</th>
                <th className="px-3 py-2">Handles</th>
                <th className="hidden px-3 py-2 md:table-cell">Mode</th>
                <th className="hidden px-3 py-2 lg:table-cell">Buy</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {props.rules.map((rule) => (
                <tr key={rule.id} className="transition-colors hover:bg-bg-hover">
                  <td className="px-3 py-1.5">
                    <div className="font-semibold text-fg-primary">{rule.name}</div>
                    <div className="text-[10px] capitalize text-fg-muted">
                      {rule.category.replace('_', ' ')} · {rule.riskMode}
                    </div>
                  </td>
                  <td className="max-w-[10rem] truncate px-3 py-1.5 text-fg-secondary">
                    {rule.handles.length
                      ? rule.handles.map((h) => `@${normalizeXHandle(h)}`).join(', ')
                      : 'All'}
                  </td>
                  <td className="hidden px-3 py-1.5 capitalize text-fg-secondary md:table-cell">
                    {rule.executionMode.replace('_', ' ')}
                  </td>
                  <td className="hidden px-3 py-1.5 lg:table-cell">
                    <span className="tabular-nums text-fg-secondary">
                      {rule.buySizeSol != null ? `${rule.buySizeSol} SOL` : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                        rule.enabled
                          ? 'border-signal-bull/40 bg-signal-bull/12 text-signal-bull'
                          : 'border-border-subtle bg-bg-hover text-fg-muted',
                      )}
                    >
                      {rule.enabled ? 'Active' : 'Off'}
                    </span>
                  </td>
                  <td className="space-x-2 whitespace-nowrap px-3 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => props.onEdit(rule)}
                      className="text-[11px] font-semibold text-accent-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => props.onDuplicate(rule)}
                      className="text-[11px] text-fg-secondary hover:underline"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-signal-bear hover:underline"
                      onClick={() => props.onRemove(rule.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- side rail · insights (default) ---------- */

function SideInsights(props: {
  insights: {
    total: number;
    fires: number;
    fails: number;
    skipped: number;
    avgConf: number;
    topHandle: { handle: string; count: number } | null;
    topIntent: { bucket: string; count: number } | null;
  };
  onNewAlert: () => void;
  onNewBuy: () => void;
  onNewLaunch: () => void;
}) {
  const { insights } = props;
  const intent = insights.topIntent ? intentFor(insights.topIntent.bucket) : null;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="shrink-0 border-b border-border-subtle px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
        24h snapshot
      </div>

      <div className="space-y-3 p-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-fg-muted">
            <span>AI confidence · avg</span>
            <span className="tabular-nums text-fg-secondary">
              {Math.round(insights.avgConf * 100)}%
            </span>
          </div>
          <ConfidenceBar value01={insights.avgConf} />
        </div>

        <div className="grid grid-cols-4 gap-1.5 text-center">
          <MiniStat label="Total" value={insights.total} tone="muted" />
          <MiniStat label="Fired" value={insights.fires} tone="bull" />
          <MiniStat label="Failed" value={insights.fails} tone="bear" />
          <MiniStat label="Skipped" value={insights.skipped} tone="muted" />
        </div>

        <div className="space-y-2 rounded-md border border-border-subtle bg-bg-hover px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-[0.12em] text-fg-muted">
              Top handle
            </span>
            <span className="truncate text-[11px] font-semibold text-fg-primary">
              {insights.topHandle ? `@${insights.topHandle.handle}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-[0.12em] text-fg-muted">
              Top intent
            </span>
            {intent ? (
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-semibold',
                  intentBadgeCls(intent.tone),
                )}
              >
                {intent.label}
              </span>
            ) : (
              <span className="text-[11px] text-fg-muted">—</span>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            New rule
          </div>
          <TemplateButton
            label="Alerts only"
            sub="Toasts + sounds. No execution."
            icon={<BellRing className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
            onClick={props.onNewAlert}
          />
          <TemplateButton
            label="Auto-buy preset"
            sub="Killswitch-gated. CA confidence required."
            icon={<Zap className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
            onClick={props.onNewBuy}
          />
          <TemplateButton
            label="Launch watcher"
            sub="Fresh-deploy phrasing + curve filters."
            icon={<Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
            onClick={props.onNewLaunch}
          />
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'bull' | 'bear' | 'muted';
}) {
  const cls =
    tone === 'bull'
      ? 'text-signal-bull'
      : tone === 'bear'
        ? 'text-signal-bear'
        : 'text-fg-primary';
  return (
    <div className="rounded-md border border-border-subtle bg-bg-hover py-1.5">
      <div className={cn('text-base font-semibold tabular-nums leading-none', cls)}>
        {value.toLocaleString()}
      </div>
      <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-fg-muted">{label}</div>
    </div>
  );
}

function TemplateButton({
  label,
  sub,
  icon,
  onClick,
}: {
  label: string;
  sub: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn-press flex w-full items-center justify-between gap-2 rounded-md border border-border-subtle bg-bg-hover px-2.5 py-2 text-left transition-colors hover:bg-bg-base hover:text-fg-primary"
    >
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold text-fg-primary">{label}</span>
        <span className="block text-[10px] text-fg-muted">{sub}</span>
      </span>
      <span className="shrink-0 text-fg-secondary">{icon}</span>
    </button>
  );
}

/* ---------- side rail · rule builder ---------- */

function RuleBuilderCard(props: {
  rule: Partial<StoredAutomationRule>;
  onChange: (p: Partial<StoredAutomationRule>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { rule, onChange } = props;
  const t = rule.triggersEnabled ?? cloneTriggers();
  const canSave = Boolean(rule.name && rule.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-subtle px-3 py-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-accent-primary" strokeWidth={2.25} aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            Rule builder
          </span>
        </div>
        <button
          type="button"
          onClick={props.onCancel}
          className="inline-flex items-center gap-1 rounded border border-border-subtle bg-bg-hover px-2 py-1 text-[10px] font-semibold text-fg-secondary hover:bg-bg-base hover:text-fg-primary"
        >
          <RefreshCcw className="h-3 w-3" strokeWidth={2} aria-hidden />
          Close
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-[12px]">
        <FieldShell label="Name">
          <input
            value={rule.name ?? ''}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full rounded-md border border-border-subtle bg-bg-hover px-2.5 py-1.5 text-fg-primary outline-none transition focus:border-accent-primary/60 focus:ring-1 focus:ring-accent-primary/40"
          />
        </FieldShell>

        <FieldShell label="Handles" hint="newline or comma">
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
            className="w-full resize-none rounded-md border border-border-subtle bg-bg-hover px-2.5 py-1.5 text-fg-primary outline-none transition focus:border-accent-primary/60 focus:ring-1 focus:ring-accent-primary/40"
          />
        </FieldShell>

        <FieldShell label="Triggers">
          <div className="space-y-px rounded-md border border-border-subtle bg-bg-hover p-1">
            {(Object.entries(t) as [AutomationTriggerType, boolean][]).map(([k, v]) => (
              <label
                key={String(k)}
                className="flex cursor-pointer items-center justify-between gap-2 rounded px-1.5 py-1 text-[11px] hover:bg-bg-base"
              >
                <span className="text-fg-secondary">{triggerLabel(k)}</span>
                <input
                  type="checkbox"
                  checked={v}
                  onChange={(e) =>
                    onChange({ triggersEnabled: { ...t, [k]: e.target.checked } })
                  }
                  className="h-3.5 w-3.5 rounded border-border-subtle accent-accent-primary"
                />
              </label>
            ))}
          </div>
        </FieldShell>

        <div className="grid grid-cols-2 gap-2">
          <FieldShell label="Mode">
            <select
              value={rule.executionMode ?? 'alert_only'}
              onChange={(e) =>
                onChange({
                  executionMode: e.target.value as StoredAutomationRule['executionMode'],
                })
              }
              className="w-full cursor-pointer rounded-md border border-border-subtle bg-bg-hover px-2 py-1.5 text-fg-primary outline-none transition focus:border-accent-primary/60"
            >
              <option value="alert_only">Alert only</option>
              <option value="one_click">One-click</option>
              <option value="auto_buy">Auto-buy</option>
            </select>
          </FieldShell>
          <FieldShell label="Timing">
            <select
              value={rule.executionTiming ?? 'precheck_then_buy'}
              onChange={(e) =>
                onChange({
                  executionTiming: e.target.value as StoredAutomationRule['executionTiming'],
                })
              }
              className="w-full cursor-pointer rounded-md border border-border-subtle bg-bg-hover px-2 py-1.5 text-fg-primary outline-none transition focus:border-accent-primary/60"
            >
              <option value="precheck_then_buy">Pre-check first</option>
              <option value="instant_then_scan">Instant, scan after</option>
            </select>
          </FieldShell>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <FieldShell label="Buy (SOL)">
            <input
              value={rule.buySizeSol ?? ''}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === '') return onChange({ buySizeSol: null });
                const n = Number(raw);
                if (Number.isFinite(n)) onChange({ buySizeSol: n });
              }}
              className="w-full rounded-md border border-border-subtle bg-bg-hover px-2.5 py-1.5 tabular-nums text-fg-primary outline-none transition focus:border-accent-primary/60 focus:ring-1 focus:ring-accent-primary/40"
            />
          </FieldShell>
          <FieldShell label="Slip bps">
            <input
              type="number"
              value={rule.slippageBps ?? ''}
              onChange={(e) =>
                onChange({ slippageBps: e.target.value ? Number(e.target.value) : null })
              }
              className="w-full rounded-md border border-border-subtle bg-bg-hover px-2.5 py-1.5 tabular-nums text-fg-primary outline-none transition focus:border-accent-primary/60 focus:ring-1 focus:ring-accent-primary/40"
            />
          </FieldShell>
        </div>

        <FieldShell label="Fixed mint CA" hint="optional">
          <input
            value={rule.fixedMintCa ?? ''}
            onChange={(e) => onChange({ fixedMintCa: e.target.value.trim() || null })}
            className="w-full rounded-md border border-border-subtle bg-bg-hover px-2.5 py-1.5 font-mono text-[11px] tabular-nums text-fg-primary outline-none transition focus:border-accent-primary/60 focus:ring-1 focus:ring-accent-primary/40"
          />
        </FieldShell>

        <FieldShell label="Keywords" hint="comma separated">
          <input
            value={(rule.keywords ?? []).join(', ')}
            onChange={(e) =>
              onChange({
                keywords: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className="w-full rounded-md border border-border-subtle bg-bg-hover px-2.5 py-1.5 text-fg-primary outline-none transition focus:border-accent-primary/60 focus:ring-1 focus:ring-accent-primary/40"
          />
        </FieldShell>

        <label className="flex cursor-pointer items-center justify-between rounded-md border border-border-subtle bg-bg-hover px-3 py-2 text-[11px]">
          <span className="text-fg-secondary">Enabled locally</span>
          <input
            type="checkbox"
            checked={rule.enabled ?? false}
            onChange={(e) => onChange({ enabled: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-border-subtle accent-accent-primary"
          />
        </label>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border-subtle px-3 py-2">
        <button
          type="button"
          onClick={props.onSave}
          disabled={!canSave}
          className="btn-press flex-1 rounded-md bg-accent-primary px-3 py-2 text-[11px] font-semibold text-fg-inverse hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          className="btn-press rounded-md border border-border-subtle bg-bg-hover px-3 py-2 text-[11px] font-semibold text-fg-secondary hover:bg-bg-base hover:text-fg-primary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function FieldShell({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
        {label}
        {hint ? (
          <span className="ml-1 font-normal normal-case tracking-normal text-fg-muted/80">
            · {hint}
          </span>
        ) : null}
      </span>
      {children}
    </label>
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
      return 'Keywords';
    case 'ai_semantic_intent':
      return 'Semantic intent';
    case 'pulse_visible_token':
      return 'Pulse mint match';
    case 'fresh_launch_style':
      return 'Fresh launch phrasing';
    default:
      return String(k);
  }
}
