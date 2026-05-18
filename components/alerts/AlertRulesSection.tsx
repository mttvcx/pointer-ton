'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { Bell, ChevronDown, ExternalLink, Loader2, PanelLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { type PulseProtocolId, PULSE_PROTOCOL_IDS } from '@/lib/tokens/columnPresetModel';
import { playAlertPresetSound } from '@/lib/alerts/alertRulePayloadAudio';
import { dispatchAlertFlashPreview } from '@/lib/alerts/alertUxPreview';
import { normalizeTwitterHandle } from '@/lib/alerts/solMintFromText';
import type { AppChainId } from '@/lib/chains/appChain';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';

/** Glass tokens — airy layers on `bg-base`, not flat grey slabs */
const UI = {
  card: 'rgba(255, 255, 255, 0.04)',
  elevated: 'rgba(255, 255, 255, 0.07)',
  border: 'rgba(255, 255, 255, 0.1)',
  muted: '#9ba3b0',
  text: '#f0f4fc',
  cyan: '#34d5ff',
} as const;

const PROTOCOL_LABEL: Record<PulseProtocolId, string> = {
  ton: 'TON Index',
  dedust: 'DeDust',
  stonfi: 'STON.fi',
  megaton: 'Megaton',
};

function launchpadChipLabel(chain: AppChainId, id: PulseProtocolId): string {
  if (chain === 'ton') return PROTOCOL_LABEL[id];
  if (chain === 'sol') {
    const m: Record<PulseProtocolId, string> = {
      ton: 'Pump-style / new',
      dedust: 'DEX pairs',
      stonfi: 'Routed venues',
      megaton: 'Other',
    };
    return m[id];
  }
  const m: Record<PulseProtocolId, string> = {
    ton: 'New pools (Gecko)',
    dedust: 'DEX listings',
    stonfi: 'Routed pairs',
    megaton: 'Other',
  };
  return m[id];
}

const FLASH_PRESETS = ['#0077B6', '#3ddc97', '#ff5e78', '#fbbf24', '#38bdf8'] as const;

const AUDIO_PRESETS = ['chime', 'bell', 'pop'] as const;

type RuleDto = {
  id: string;
  name: string;
  ruleType: string;
  ruleConfig: unknown;
  flashEnabled: boolean;
  flashColor: string;
  flashSize: string;
  audioEnabled: boolean;
  audioUrl: string | null;
  audioPreset: string;
  isActive: boolean;
  createdAt: string;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: UI.muted }}>
      {children}
    </p>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-0.5 flex items-baseline justify-between gap-2">
      <span className="text-[10px] font-medium" style={{ color: UI.muted }}>
        {children}
      </span>
      {hint ? (
        <span className="max-w-[52%] truncate text-right text-[9px]" style={{ color: UI.muted }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function ToggleRow({ children }: { children: React.ReactNode }) {
  return <div className="inline-flex items-center gap-2">{children}</div>;
}

/** Detached Pulse alert builder — reused from Explore and other shells. */
export function openAlertRulesPopoutDetached() {
  const header = document.querySelector('header');
  const top = Math.round((header?.getBoundingClientRect().bottom ?? 72) + 8);
  const w = Math.min(440, Math.max(300, Math.round(window.innerWidth * 0.38)));
  const bottomReserve = 64;
  const h = Math.min(600, Math.max(320, window.innerHeight - top - bottomReserve));
  const st = useUIStore.getState();
  st.setAlertRulesDocked(false);
  st.setAlertRulesPopout({ top, left: 14, width: w, height: h });
}

export function AlertRulesSection({
  embedInFloatingPanel = false,
  showPopoutLauncher = false,
  variant = 'default',
}: {
  embedInFloatingPanel?: boolean;
  showPopoutLauncher?: boolean;
  /** Compact layout for the Cluely top strip when the side rail is closed. `modal` = centered dialog body (no duplicate chrome). */
  variant?: 'default' | 'strip' | 'modal';
} = {}) {
  const { authenticated, getAccessToken } = usePointerAuth();
  const activeChain = useUIStore((s) => s.activeChain);
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [selectedPads, setSelectedPads] = useState<Set<PulseProtocolId>>(
    () => new Set(),
  );
  const [minLiq, setMinLiq] = useState('');
  const [flashEnabled, setFlashEnabled] = useState(true);
  const [flashColor, setFlashColor] = useState('#0077B6');
  const [flashSize, setFlashSize] = useState<'normal' | 'large'>('normal');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioPreset, setAudioPreset] = useState<(typeof AUDIO_PRESETS)[number]>('chime');
  const [audioUrl, setAudioUrl] = useState('');
  const [builderOpen, setBuilderOpen] = useState(true);
  const [advancedNotifOpen, setAdvancedNotifOpen] = useState(false);
  const [creatorKind, setCreatorKind] = useState<'pulse_launchpad' | 'sol_twitter_listen'>(
    'pulse_launchpad',
  );
  const [twHandles, setTwHandles] = useState('');
  const [twPhrases, setTwPhrases] = useState('');
  const [twPhraseMatch, setTwPhraseMatch] = useState<'substring' | 'whole_word'>('substring');
  const [twExecution, setTwExecution] = useState<'notify' | 'auto_buy'>('notify');
  const [twBuySol, setTwBuySol] = useState('');

  const useFlatHeader = embedInFloatingPanel || variant === 'strip' || variant === 'modal';
  const showForm = useFlatHeader || builderOpen;

  useEffect(() => {
    if (activeChain !== 'sol' && creatorKind === 'sol_twitter_listen') {
      setCreatorKind('pulse_launchpad');
    }
  }, [activeChain, creatorKind]);

  const listQuery = useQuery({
    queryKey: ['alert-rules'],
    enabled: authenticated,
    queryFn: async (): Promise<RuleDto[]> => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/alert-rules', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('list_failed');
      const j = (await res.json()) as { rules: RuleDto[] };
      return j.rules;
    },
  });

  function parseTwitterHandles(raw: string): string[] {
    const parts = raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => normalizeTwitterHandle(s))
      .filter(Boolean);
    return [...new Set(parts)];
  }

  function parseTwitterPhrases(raw: string): string[] {
    const parts = raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return [...new Set(parts)].slice(0, 64);
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');

      const audioUrlTrim = audioUrl.trim();
      let safeAudioUrl: string | null = null;
      if (audioUrlTrim) {
        try {
          const u = new URL(audioUrlTrim);
          if (u.protocol === 'https:') safeAudioUrl = audioUrlTrim;
        } catch {
          /* ignore */
        }
      }

      let ruleType: 'pulse_launchpad' | 'sol_twitter_listen' = 'pulse_launchpad';
      let ruleConfig: Record<string, unknown>;

      if (creatorKind === 'sol_twitter_listen') {
        const handles = parseTwitterHandles(twHandles);
        const phrases = parseTwitterPhrases(twPhrases);
        if (handles.length === 0) {
          throw new Error('Add at least one X handle');
        }
        ruleType = 'sol_twitter_listen';
        const buyParsed =
          twBuySol.trim() === '' ? null : Number(twBuySol.trim());
        const buyPreset =
          buyParsed != null && Number.isFinite(buyParsed) && buyParsed > 0 ? buyParsed : null;
        ruleConfig = {
          handles,
          phrases,
          phraseMatch: twPhraseMatch,
          execution: twExecution,
          ...(buyPreset != null ? { buySolPreset: buyPreset } : {}),
        };
      } else {
        ruleConfig = {};
        if (selectedPads.size > 0) {
          ruleConfig.launchpads = [...selectedPads];
        }
        const liq = minLiq.trim() === '' ? null : Number(minLiq);
        if (liq != null && Number.isFinite(liq) && liq > 0) {
          ruleConfig.minInitialLiquiditySol = liq;
        }
      }

      const res = await fetch('/api/alert-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          ruleType,
          ruleConfig,
          flashEnabled,
          flashColor,
          flashSize,
          audioEnabled,
          audioPreset,
          ...(safeAudioUrl != null ? { audioUrl: safeAudioUrl } : { audioUrl: null }),
          isActive: true,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? 'create_failed');
      }
    },
    onSuccess: () => {
      setName('');
      setMinLiq('');
      setSelectedPads(new Set());
      setTwHandles('');
      setTwPhrases('');
      setTwPhraseMatch('substring');
      setTwExecution('notify');
      setTwBuySol('');
      setCreatorKind('pulse_launchpad');
      void qc.invalidateQueries({ queryKey: ['alert-rules'] });
      toast.success('Alert rule saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchMutation = useMutation({
    mutationFn: async (vars: { id: string; body: Record<string, unknown> }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(`/api/alert-rules/${encodeURIComponent(vars.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(vars.body),
      });
      if (!res.ok) throw new Error('update_failed');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['alert-rules'] });
    },
    onError: () => toast.error('Could not update rule'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(`/api/alert-rules/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('delete_failed');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['alert-rules'] });
      toast.success('Rule removed');
    },
    onError: () => toast.error('Could not delete rule'),
  });

  const sorted = useMemo(() => {
    const rows = listQuery.data ?? [];
    return [...rows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [listQuery.data]);

  function toggleProtocol(id: PulseProtocolId) {
    setSelectedPads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!authenticated) {
    return (
      <div
        className="rounded-2xl border px-4 py-3 text-[11px] leading-relaxed backdrop-blur-md"
        style={{ borderColor: UI.border, backgroundColor: UI.card, color: UI.muted }}
      >
        Sign in to save alert rules for new Pulse listings.
      </div>
    );
  }

  const inputCls =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/35 focus-visible:ring-offset-0 w-full rounded-xl border px-3 py-2.5 text-[13px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition';

  return (
    <div className={cn('flex flex-col', variant === 'strip' ? 'gap-2' : 'gap-3')}>
      {/* Alert Builder */}
      <section
        id="copilot-alert-builder"
        className={cn(
          'overflow-hidden border backdrop-blur-md shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]',
          variant === 'strip' ? 'rounded-xl' : 'rounded-2xl',
        )}
        style={{ borderColor: UI.border, backgroundColor: UI.card }}
      >
        {variant !== 'modal' ? (
          !useFlatHeader ? (
            <div className="flex items-stretch gap-1 border-b border-white/[0.06] px-3 py-2">
              <button
                type="button"
                onClick={() => setBuilderOpen((v) => !v)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.04]"
                aria-expanded={builderOpen}
              >
                <span className="text-[13px] font-semibold" style={{ color: UI.text }}>
                  Alert Builder
                </span>
                <span
                  className="rounded-full border px-2 py-px text-[10px] font-medium"
                  style={{
                    borderColor: `${UI.cyan}44`,
                    color: UI.cyan,
                    backgroundColor: `${UI.cyan}10`,
                  }}
                >
                  Rule-based
                </span>
                <ChevronDown
                  className={cn(
                    'ml-auto h-4 w-4 shrink-0 transition-transform',
                    builderOpen ? 'rotate-180' : 'rotate-0',
                  )}
                  style={{ color: UI.muted }}
                />
              </button>
              {showPopoutLauncher ? (
                <>
                  <button
                    type="button"
                    onClick={() => useUIStore.getState().setAlertRulesDocked(true)}
                    className="focus-ring shrink-0 self-center rounded-lg border border-white/10 bg-white/[0.03] p-2 text-fg-muted transition hover:bg-white/[0.06] hover:text-fg-primary"
                    title="Dock in left shell"
                    aria-label="Dock alert builder in left rail"
                  >
                    <PanelLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openAlertRulesPopoutDetached()}
                    className="focus-ring shrink-0 self-center rounded-lg border border-white/10 bg-white/[0.03] p-2 text-fg-muted transition hover:bg-white/[0.06] hover:text-fg-primary"
                    title="Pop out — drag, resize, dock to edge"
                    aria-label="Pop out alert builder"
                  >
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </button>
                </>
              ) : null}
            </div>
          ) : (
            <div
              className={cn(
                'flex items-center gap-1 border-b border-white/[0.06]',
                variant === 'strip'
                  ? 'px-3 py-2'
                  : 'bg-gradient-to-b from-white/[0.05] to-transparent px-4 py-3 backdrop-blur-sm',
              )}
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold tracking-tight" style={{ color: UI.text }}>
                  Alert Builder
                </span>
                <span
                  className="rounded-full border px-2 py-px text-[10px] font-medium"
                  style={{
                    borderColor: `${UI.cyan}44`,
                    color: UI.cyan,
                    backgroundColor: `${UI.cyan}10`,
                  }}
                >
                  Rule-based
                </span>
              </div>
              {variant === 'strip' && showPopoutLauncher ? (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => useUIStore.getState().setAlertRulesDocked(true)}
                    className="focus-ring rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-fg-muted transition hover:bg-white/[0.06] hover:text-fg-primary"
                    title="Dock in left shell"
                    aria-label="Dock alert builder in left rail"
                  >
                    <PanelLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openAlertRulesPopoutDetached()}
                    className="focus-ring rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-fg-muted transition hover:bg-white/[0.06] hover:text-fg-primary"
                    title="Pop out"
                    aria-label="Pop out alert builder"
                  >
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </button>
                </div>
              ) : null}
            </div>
          )
        ) : null}

        {showForm ? (
          <form
            className={cn('space-y-3', variant === 'strip' ? 'px-3 py-2.5' : 'px-4 py-3')}
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) {
                toast.error('Name your rule');
                return;
              }
              if (creatorKind === 'sol_twitter_listen') {
                if (parseTwitterHandles(twHandles).length === 0) {
                  toast.error('Add at least one X handle');
                  return;
                }
              }
              createMutation.mutate();
            }}
          >
            {/* A. Trigger */}
            <div className="space-y-2.5">
              <SectionLabel>Trigger</SectionLabel>
              {activeChain === 'sol' ? (
                <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
                  <button
                    type="button"
                    onClick={() => setCreatorKind('pulse_launchpad')}
                    className={cn(
                      'flex-1 rounded-lg py-1.5 text-center text-[10px] font-semibold transition',
                      creatorKind === 'pulse_launchpad'
                        ? 'bg-white/[0.12] text-[#f0f4fc] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]'
                        : 'text-fg-muted hover:bg-white/[0.04]',
                    )}
                  >
                    Pulse launchpads
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatorKind('sol_twitter_listen')}
                    className={cn(
                      'flex-1 rounded-lg py-1.5 text-center text-[10px] font-semibold transition',
                      creatorKind === 'sol_twitter_listen'
                        ? 'bg-white/[0.12] text-[#f0f4fc] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]'
                        : 'text-fg-muted hover:bg-white/[0.04]',
                    )}
                  >
                    X listens
                  </button>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <FieldLabel>Rule name</FieldLabel>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    creatorKind === 'sol_twitter_listen'
                      ? 'Whale-watch · CA drops'
                      : 'Pump fresh launches'
                  }
                  className={inputCls}
                  style={{
                    borderColor: UI.border,
                    backgroundColor: UI.elevated,
                    color: UI.text,
                  }}
                />
              </div>

              {creatorKind === 'sol_twitter_listen' ? (
                <>
                  <div className="space-y-1.5">
                    <FieldLabel hint="@optional — comma or space">Handles</FieldLabel>
                    <textarea
                      value={twHandles}
                      onChange={(e) => setTwHandles(e.target.value)}
                      rows={2}
                      placeholder={'elonmusk, solana'}
                      className={cn(inputCls, 'min-h-[2.75rem] resize-y text-[12px] leading-snug')}
                      style={{
                        borderColor: UI.border,
                        backgroundColor: UI.elevated,
                        color: UI.text,
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel hint="Empty = any tweet from those handles">
                      Literal phrases (optional)
                    </FieldLabel>
                    <textarea
                      value={twPhrases}
                      onChange={(e) => setTwPhrases(e.target.value)}
                      rows={2}
                      placeholder={'One phrase per line (or comma-separated)'}
                      className={cn(inputCls, 'min-h-[2.75rem] resize-y text-[12px] leading-snug')}
                      style={{
                        borderColor: UI.border,
                        backgroundColor: UI.elevated,
                        color: UI.text,
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <FieldLabel hint="Substring vs standalone token">Phrase match</FieldLabel>
                    <select
                      value={twPhraseMatch}
                      onChange={(e) =>
                        setTwPhraseMatch(e.target.value as 'substring' | 'whole_word')
                      }
                      className={cn(inputCls, 'py-2 text-[12px]')}
                      style={{
                        borderColor: UI.border,
                        backgroundColor: UI.elevated,
                        color: UI.text,
                      }}
                    >
                      <option value="substring">Substring</option>
                      <option value="whole_word">Whole word</option>
                    </select>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <FieldLabel hint="Leave empty for any launchpad">
                    Launchpads
                  </FieldLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {PULSE_PROTOCOL_IDS.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleProtocol(id)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[10px] font-medium transition active:scale-[0.98]',
                          selectedPads.has(id)
                            ? 'border-accent-primary/40 bg-accent-primary/10 text-fg-primary'
                            : '',
                        )}
                        style={
                          selectedPads.has(id)
                            ? undefined
                            : {
                                borderColor: UI.border,
                                backgroundColor: UI.elevated,
                                color: UI.muted,
                              }
                        }
                      >
                        {launchpadChipLabel(activeChain, id)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-white/[0.06] pt-3" />

            {/* B. Conditions */}
            {creatorKind === 'pulse_launchpad' ? (
              <>
                <div className="space-y-2.5">
                  <SectionLabel>Conditions</SectionLabel>
                  <div className="space-y-1">
                    <FieldLabel hint="Optional">
                      {activeChain === 'ton'
                        ? 'Minimum initial TON'
                        : activeChain === 'sol'
                          ? 'Minimum initial SOL (when available)'
                          : `Minimum liquidity hint (${nativeTicker(activeChain)})`}
                    </FieldLabel>
                    <input
                      value={minLiq}
                      onChange={(e) => setMinLiq(e.target.value)}
                      inputMode="decimal"
                      placeholder="e.g. 2"
                      className={cn(inputCls, 'tabular-nums')}
                      style={{
                        borderColor: UI.border,
                        backgroundColor: UI.elevated,
                        color: UI.text,
                      }}
                    />
                  </div>
                  <p className="text-[10px] leading-snug" style={{ color: UI.muted }}>
                    Holder, bundle, and sniper routing is planned—this rule watches launch metadata
                    only.
                  </p>
                </div>
                <div className="border-t border-white/[0.06] pt-3" />
              </>
            ) : (
              <>
                <p className="text-[10px] leading-snug" style={{ color: UI.muted }}>
                  When ingest posts a tweet, we literal-match phrases in the tweet text. If a mint
                  appears (base58 in text or URLs), Pulse can surface auto-buy intent (server-gated).
                </p>
                <div className="border-t border-white/[0.06] pt-3" />
              </>
            )}

            {/* Action */}
            <div className="space-y-2">
              <SectionLabel>Action</SectionLabel>
              {creatorKind === 'sol_twitter_listen' ? (
                <>
                  <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
                    <button
                      type="button"
                      onClick={() => setTwExecution('notify')}
                      className={cn(
                        'rounded-lg py-2 text-center text-[11px] font-semibold transition',
                        twExecution === 'notify'
                          ? 'bg-white/[0.11] text-[#f0f4fc] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]'
                          : 'text-fg-muted hover:bg-white/[0.04]',
                      )}
                    >
                      Notify only
                    </button>
                    <button
                      type="button"
                      title="Marked auto_buy when ingest finds a mint and POINTER_TWITTER_AUTOBUY=1"
                      onClick={() => setTwExecution('auto_buy')}
                      className={cn(
                        'rounded-lg py-2 text-center text-[11px] font-semibold transition',
                        twExecution === 'auto_buy'
                          ? 'bg-white/[0.11] text-[#f0f4fc] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]'
                          : 'text-fg-muted hover:bg-white/[0.04]',
                      )}
                    >
                      Auto-buy
                    </button>
                  </div>
                  {twExecution === 'auto_buy' ? (
                    <div className="space-y-1">
                      <FieldLabel hint="Empty = derive from Pulse quick-buy later">SOL per buy</FieldLabel>
                      <input
                        value={twBuySol}
                        onChange={(e) => setTwBuySol(e.target.value)}
                        inputMode="decimal"
                        placeholder="inherit"
                        className={cn(inputCls, 'tabular-nums')}
                        style={{
                          borderColor: UI.border,
                          backgroundColor: UI.elevated,
                          color: UI.text,
                        }}
                      />
                    </div>
                  ) : null}
                  <p className="text-[10px] leading-snug" style={{ color: UI.muted }}>
                    Server unattended swap wiring is separate—alerts carry mint + intent for client
                    follow-up today.
                  </p>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
                    <span
                      className="rounded-lg bg-white/[0.11] py-2 text-center text-[11px] font-semibold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)]"
                      style={{ color: UI.text }}
                    >
                      Notify only
                    </span>
                    <button
                      type="button"
                      disabled
                      title="Auto-buy on rule match — coming soon"
                      className="rounded-lg py-2 text-center text-[11px] font-medium text-fg-muted opacity-45"
                    >
                      Auto-buy
                    </button>
                  </div>
                  <p className="text-[10px] leading-snug" style={{ color: UI.muted }}>
                    Auto-buy will mirror your Pulse quick-buy amount when a launch hits this rule —
                    wiring next.
                  </p>
                </>
              )}
            </div>

            <div className="border-t border-white/[0.06] pt-3" />

            {/* C. Notification */}
            <div className="space-y-3">
              <SectionLabel>Notification</SectionLabel>

              <div className="flex flex-wrap items-center gap-2">
                <ToggleRow>
                  <input
                    id="copilot-flash"
                    type="checkbox"
                    checked={flashEnabled}
                    onChange={(e) => setFlashEnabled(e.target.checked)}
                    className="rounded border"
                    style={{ borderColor: UI.border }}
                  />
                  <label htmlFor="copilot-flash" className="text-[11px]" style={{ color: UI.text }}>
                    Screen flash
                  </label>
                </ToggleRow>
                <div className="flex flex-wrap items-center gap-1.5">
                  {FLASH_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      disabled={!flashEnabled}
                      onClick={() => setFlashColor(c)}
                      className={cn(
                        'h-8 w-8 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-[rgba(8,13,20,0.92)] transition disabled:opacity-35',
                        flashEnabled && flashColor.toLowerCase() === c.toLowerCase()
                          ? 'ring-[#f5f7ff]'
                          : 'ring-transparent hover:ring-white/20',
                      )}
                      style={{ backgroundColor: c }}
                      aria-label={`Flash color ${c}`}
                    />
                  ))}
                </div>
                <select
                  value={flashSize}
                  disabled={!flashEnabled}
                  onChange={(e) => setFlashSize(e.target.value as 'normal' | 'large')}
                  className={cn(inputCls, 'max-w-[140px] shrink-0 py-1 text-[11px]')}
                  style={{
                    borderColor: UI.border,
                    backgroundColor: UI.elevated,
                    color: UI.muted,
                  }}
                >
                  <option value="normal">Flash · normal</option>
                  <option value="large">Flash · large</option>
                </select>
                <button
                  type="button"
                  title="Triggers the same fullscreen tint Pulse uses — ignores the Screen flash checkbox so you can test themes anytime."
                  onClick={() =>
                    dispatchAlertFlashPreview({
                      color: /^#[0-9A-Fa-f]{6}$/.test(flashColor) ? flashColor : '#0077B6',
                      size: flashSize,
                    })
                  }
                  className="rounded-lg border px-2 py-1 text-[10px] font-semibold transition hover:bg-white/[0.05]"
                  style={{ borderColor: UI.border, color: UI.text }}
                >
                  Demo flash
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <ToggleRow>
                  <input
                    id="copilot-audio"
                    type="checkbox"
                    checked={audioEnabled}
                    onChange={(e) => setAudioEnabled(e.target.checked)}
                    className="rounded border"
                    style={{ borderColor: UI.border }}
                  />
                  <label htmlFor="copilot-audio" className="text-[11px]" style={{ color: UI.text }}>
                    Sound alert
                  </label>
                </ToggleRow>
                <select
                  value={audioPreset}
                  onChange={(e) =>
                    setAudioPreset(e.target.value as (typeof AUDIO_PRESETS)[number])
                  }
                  className={cn(inputCls, 'max-w-[120px] py-1 text-[11px]')}
                  style={{
                    borderColor: UI.border,
                    backgroundColor: UI.elevated,
                    color: UI.muted,
                  }}
                  disabled={!audioEnabled}
                >
                  {AUDIO_PRESETS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  title="Runs flash + preset chime once (helps verify theme + autoplay)."
                  className="rounded-lg border border-accent-primary/45 px-2 py-1 text-[10px] font-semibold text-accent-primary transition hover:bg-white/[0.05]"
                  onClick={() => {
                    dispatchAlertFlashPreview({
                      color: /^#[0-9A-Fa-f]{6}$/.test(flashColor) ? flashColor : '#0077B6',
                      size: flashSize,
                    });
                    void playAlertPresetSound(audioPreset);
                  }}
                >
                  Demo all
                </button>
                <button
                  type="button"
                  disabled={!audioEnabled}
                  title="Sound only — respects Screen flash / Sound checkboxes upstream."
                  onClick={() => void playAlertPresetSound(audioPreset)}
                  className="rounded-lg border px-2 py-1 text-[10px] font-semibold transition hover:bg-white/[0.05] disabled:opacity-35"
                  style={{ borderColor: UI.border, color: UI.text }}
                >
                  Test tone
                </button>
              </div>

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg border px-2 py-1.5 text-left text-[11px] font-medium transition hover:bg-white/[0.03]"
                style={{ borderColor: UI.border, color: UI.muted }}
                onClick={() => setAdvancedNotifOpen((v) => !v)}
                aria-expanded={advancedNotifOpen}
              >
                Advanced notification settings
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', advancedNotifOpen ? 'rotate-180' : '')}
                  aria-hidden
                />
              </button>
              {advancedNotifOpen ? (
                <div className="space-y-1 rounded-lg border p-2" style={{ borderColor: UI.border }}>
                  <FieldLabel hint="HTTPS only">Custom sound URL</FieldLabel>
                  <input
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                    placeholder="https://..."
                    disabled={!audioEnabled}
                    className={cn(inputCls, 'tabular-nums text-[11px]')}
                    style={{
                      borderColor: UI.border,
                      backgroundColor: UI.elevated,
                      color: UI.text,
                    }}
                  />
                </div>
              ) : null}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full rounded-xl py-2.5 text-[13px] font-semibold text-fg-inverse shadow-[0_8px_24px_-8px_rgb(var(--accent-primary-rgb)/0.55)] transition hover:brightness-105 active:scale-[0.99] disabled:opacity-45"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, rgb(var(--accent-primary-rgb)) 0%, rgb(var(--accent-glow-rgb)) 100%)',
              }}
            >
              {createMutation.isPending ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </span>
              ) : (
                'Create Alert'
              )}
            </button>
          </form>
        ) : null}
      </section>

      {/* Active Rules */}
      <section
        className={cn(
          'border backdrop-blur-md shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]',
          variant === 'strip'
            ? 'rounded-xl px-3 py-2.5'
            : 'rounded-2xl px-4 py-3',
        )}
        style={{ borderColor: UI.border, backgroundColor: UI.card }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold" style={{ color: UI.text }}>
            Active Rules
          </span>
          <span className="min-w-[22px] rounded-full border border-accent-primary/35 bg-accent-primary/10 px-1.5 py-px text-center text-[11px] font-semibold tabular-nums text-accent-primary">
            {sorted.length}
          </span>
        </div>

        {listQuery.isLoading ? (
          <ul className="space-y-1.5">
            {Array.from({ length: 2 }, (_, i) => (
              <li
                key={i}
                className="h-14 animate-pulse rounded-lg border"
                style={{ borderColor: UI.border }}
              />
            ))}
          </ul>
        ) : sorted.length === 0 ? (
          <div
            className="flex gap-2 rounded-lg border px-2 py-2"
            style={{ borderColor: UI.border, backgroundColor: UI.elevated }}
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: `${UI.border}` }}>
              <Bell className="h-4 w-4" style={{ color: UI.muted }} />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium" style={{ color: UI.text }}>
                No active rules
              </p>
              <p className="mt-0.5 text-[10px] leading-snug" style={{ color: UI.muted }}>
                Create your first alert to watch new launches automatically.
              </p>
            </div>
          </div>
        ) : (
          <ul
            className={cn(
              'space-y-1.5 overflow-y-auto pr-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
              variant === 'strip'
                ? 'max-h-[min(180px,30vh)]'
                : variant === 'modal'
                  ? 'max-h-[min(260px,42vh)]'
                  : 'max-h-[200px]',
            )}
          >
            {sorted.map((r) => (
              <li
                key={r.id}
                className="flex items-start gap-2 rounded-lg border px-2 py-1.5"
                style={{
                  borderColor: UI.border,
                  backgroundColor: UI.elevated,
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-semibold" style={{ color: UI.text }}>
                    {r.name}
                  </div>
                  <div className="mt-0.5 tabular-nums text-[10px] leading-snug" style={{ color: UI.muted }}>
                    <span>{ruleSummary(r, activeChain)}</span>
                    <span className="opacity-75">
                      {r.audioEnabled
                        ? ` · sound (${r.audioUrl ? 'custom' : r.audioPreset})`
                        : ' · silent'}
                    </span>
                  </div>
                </div>
                <label className="flex shrink-0 flex-col items-center gap-px" title="Sound on match">
                  <span className="text-[9px]" style={{ color: UI.muted }}>
                    Sfx
                  </span>
                  <input
                    type="checkbox"
                    checked={r.audioEnabled}
                    disabled={patchMutation.isPending}
                    onChange={(e) => {
                      patchMutation.mutate({
                        id: r.id,
                        body: { audioEnabled: e.target.checked },
                      });
                    }}
                    className="rounded border"
                    style={{ borderColor: UI.border }}
                  />
                </label>
                <label className="flex shrink-0 flex-col items-center gap-px">
                  <span className="text-[9px]" style={{ color: UI.muted }}>
                    On
                  </span>
                  <input
                    type="checkbox"
                    checked={r.isActive}
                    disabled={patchMutation.isPending}
                    onChange={(e) => {
                      patchMutation.mutate({
                        id: r.id,
                        body: { isActive: e.target.checked },
                      });
                    }}
                    className="rounded border"
                    style={{ borderColor: UI.border }}
                  />
                </label>
                <button
                  type="button"
                  aria-label="Delete rule"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(r.id)}
                  className="focus-ring shrink-0 rounded-md p-1 transition hover:bg-white/[0.06]"
                  style={{ color: UI.muted }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ruleSummary(r: RuleDto, chain: AppChainId): string {
  if (r.ruleType === 'sol_twitter_listen' && r.ruleConfig && typeof r.ruleConfig === 'object') {
    const cfg = r.ruleConfig as {
      handles?: string[];
      phrases?: string[];
      execution?: string;
      buySolPreset?: number | null;
    };
    const h =
      cfg.handles?.length ? `@${cfg.handles.slice(0, 3).join(', @')}` : 'handles';
    const ph = cfg.phrases?.length ? ` · phrases ${cfg.phrases.length}` : ' · any text';
    const exe = cfg.execution === 'auto_buy' ? ' · auto-buy' : '';
    const sol =
      cfg.execution === 'auto_buy' && cfg.buySolPreset != null && cfg.buySolPreset > 0
        ? ` · ${cfg.buySolPreset} SOL`
        : '';
    return `X listens ${h}${ph}${exe}${sol}`;
  }
  if (r.ruleType !== 'pulse_launchpad' || !r.ruleConfig || typeof r.ruleConfig !== 'object') {
    return r.ruleType;
  }
  const c = r.ruleConfig as {
    launchpads?: PulseProtocolId[];
    minInitialLiquiditySol?: number | null;
  };
  const pads =
    c.launchpads?.length ? c.launchpads.map((p) => PROTOCOL_LABEL[p] ?? p).join(', ') : 'any pad';
  const ticker = nativeTicker(chain);
  const liq =
    c.minInitialLiquiditySol != null && c.minInitialLiquiditySol > 0
      ? ` · min ${c.minInitialLiquiditySol} ${ticker}`
      : '';
  return `${pads}${liq}`;
}
