'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { Bell, ChevronDown, ExternalLink, Loader2, PanelLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { type PulseProtocolId, PULSE_PROTOCOL_IDS } from '@/lib/tokens/columnPresetModel';
import { playAlertPresetSound } from '@/lib/alerts/alertRulePayloadAudio';
import type { AppChainId } from '@/lib/chains/appChain';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';

const UI = {
  card: '#11141b',
  elevated: '#151924',
  border: '#202636',
  muted: '#7f8aa3',
  text: '#f5f7ff',
  accent: '#0077b6',
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
    <p className="text-[11px] font-semibold" style={{ color: UI.text }}>
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

function openAlertRulesPopout() {
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
}: {
  embedInFloatingPanel?: boolean;
  showPopoutLauncher?: boolean;
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

  const createMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const ruleConfig: {
        launchpads?: PulseProtocolId[];
        minInitialLiquiditySol?: number | null;
      } = {};
      if (selectedPads.size > 0) {
        ruleConfig.launchpads = [...selectedPads];
      }
      const liq = minLiq.trim() === '' ? null : Number(minLiq);
      if (liq != null && Number.isFinite(liq) && liq > 0) {
        ruleConfig.minInitialLiquiditySol = liq;
      }
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
      const res = await fetch('/api/alert-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          ruleType: 'pulse_launchpad',
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
        className="rounded-xl border px-3 py-2 text-[11px] leading-snug"
        style={{ borderColor: UI.border, backgroundColor: UI.card, color: UI.muted }}
      >
        Sign in to save alert rules for new Pulse listings.
      </div>
    );
  }

  const inputCls =
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0077b6]/45 w-full rounded-lg border px-2 py-1.5 text-[12px] transition';

  return (
    <div className="flex flex-col gap-2">
      {/* Alert Builder */}
      <section
        id="copilot-alert-builder"
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: UI.border, backgroundColor: UI.card }}
      >
        {!embedInFloatingPanel ? (
          <div className="flex items-stretch gap-0.5 px-2 py-1.5">
            <button
              type="button"
              onClick={() => setBuilderOpen((v) => !v)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.03]"
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
                  onClick={() => openAlertRulesPopout()}
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
          <div className="border-b px-3 py-2" style={{ borderColor: UI.border }}>
            <span className="text-[13px] font-semibold" style={{ color: UI.text }}>
              Alert Builder
            </span>
            <span
              className="ml-2 rounded-full border px-2 py-px text-[10px] font-medium"
              style={{
                borderColor: `${UI.cyan}44`,
                color: UI.cyan,
                backgroundColor: `${UI.cyan}10`,
              }}
            >
              Rule-based
            </span>
          </div>
        )}

        {embedInFloatingPanel || builderOpen ? (
          <form
            className={cn('space-y-2 px-3 py-2', !embedInFloatingPanel && 'border-t')}
            style={{ borderColor: UI.border }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) {
                toast.error('Name your rule');
                return;
              }
              createMutation.mutate();
            }}
          >
            {/* A. Trigger */}
            <div className="space-y-2">
              <SectionLabel>Trigger</SectionLabel>
              <div className="space-y-1">
                <FieldLabel>Rule name</FieldLabel>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Pump fresh launches"
                  className={inputCls}
                  style={{
                    borderColor: UI.border,
                    backgroundColor: UI.elevated,
                    color: UI.text,
                  }}
                />
              </div>
              <div className="space-y-1">
                <FieldLabel hint="Leave empty for any launchpad">
                  Launchpads
                </FieldLabel>
                <div className="flex flex-wrap gap-1">
                  {PULSE_PROTOCOL_IDS.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleProtocol(id)}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-medium transition',
                      )}
                      style={
                        selectedPads.has(id)
                          ? {
                              borderColor: `${UI.accent}66`,
                              backgroundColor: `${UI.accent}14`,
                              color: UI.text,
                            }
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
            </div>

            <div className="border-t pt-2" style={{ borderColor: UI.border }} />

            {/* B. Conditions */}
            <div className="space-y-2">
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
                Holder, bundle, and sniper routing is planned—this rule watches launch metadata only.
              </p>
            </div>

            <div className="border-t pt-2" style={{ borderColor: UI.border }} />

            {/* C. Notification */}
            <div className="space-y-2">
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
                        'h-7 w-7 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-[#11141b] transition disabled:opacity-35',
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
                  disabled={!audioEnabled}
                  onClick={() => void playAlertPresetSound(audioPreset)}
                  className="rounded-lg border px-2 py-1 text-[10px] font-semibold transition hover:bg-white/[0.05] disabled:opacity-35"
                  style={{ borderColor: UI.border, color: UI.text }}
                >
                  Test
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

            {/* D. Action */}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full rounded-lg py-2 text-[12px] font-semibold transition disabled:opacity-45"
              style={{
                backgroundImage: `linear-gradient(135deg, ${UI.accent} 0%, #5f8bff 100%)`,
                color: '#080d14',
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
        className="rounded-xl border px-3 py-2"
        style={{ borderColor: UI.border, backgroundColor: UI.card }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold" style={{ color: UI.text }}>
            Active Rules
          </span>
          <span
            className="min-w-[22px] rounded-full border px-1.5 py-px text-center text-[11px] font-semibold tabular-nums"
            style={{
              borderColor: `${UI.accent}55`,
              color: UI.accent,
              backgroundColor: `${UI.accent}10`,
            }}
          >
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
          <ul className="max-h-[200px] space-y-1 overflow-y-auto pr-0.5">
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
                    <span>{ruleSummary(r)}</span>
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

function ruleSummary(r: RuleDto): string {
  if (r.ruleType !== 'pulse_launchpad' || !r.ruleConfig || typeof r.ruleConfig !== 'object') {
    return r.ruleType;
  }
  const c = r.ruleConfig as {
    launchpads?: PulseProtocolId[];
    minInitialLiquiditySol?: number | null;
  };
  const pads =
    c.launchpads?.length ? c.launchpads.map((p) => PROTOCOL_LABEL[p] ?? p).join(', ') : 'any pad';
  const liq =
    c.minInitialLiquiditySol != null && c.minInitialLiquiditySol > 0
      ? ` / min ${c.minInitialLiquiditySol} TON`
      : '';
  return `${pads}${liq}`;
}
