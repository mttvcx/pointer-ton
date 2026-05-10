'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Share2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { PulseColumnId } from '@/lib/utils/constants';
import {
  type ColumnDisplayOptions,
  type ColumnFilters,
  type ColumnPresetSharePayload,
  type ColumnSortKey,
  COLUMN_SORT_KEYS,
  BUY_BUTTON_STYLES,
  type BuyButtonStyle,
  PULSE_SECOND_BUTTON_MODES,
  type PulseSecondButtonMode,
  DEFAULT_COLUMN_DISPLAY_OPTIONS,
  DEFAULT_COLUMN_FILTERS,
  encodeColumnPresetShare,
  normalizeColumnDisplayOptions,
  normalizeColumnFilters,
  parseImportedPresetJson,
  type PulseProtocolId,
  PULSE_PROTOCOL_IDS,
} from '@/lib/tokens/columnPresetModel';
import type { ColumnPulsePresetSlot } from '@/store/pulseColumns';
import { usePulseColumnStore } from '@/store/pulseColumns';
import { useUIStore } from '@/store/ui';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { cn } from '@/lib/utils/cn';

const FILTER_MODAL_BG = '#151820';
const FILTER_MODAL_BORDER = '#2a2f3a';
const FILTER_FIELD_BG = '#0f1118';

const PROTOCOL_LABEL: Record<PulseProtocolId, string> = {
  ton: 'TON Index',
  dedust: 'DeDust',
  stonfi: 'STON.fi',
  megaton: 'Megaton',
};

const SORT_LABELS: Record<ColumnSortKey, string> = {
  created_at: 'Age (created)',
  market_cap_usd: 'Market cap',
  liquidity_usd: 'Liquidity',
  holder_count: 'Holders',
  volume_24h_usd: 'Volume 24h',
  age_minutes: 'Age (minutes)',
  bonding_curve_pct: 'Bonding %',
};

type TabId = 'protocols' | 'metrics' | 'social' | 'display';

export type ColumnPresetRowDto = {
  id: string;
  name: string | null;
  filters: unknown;
  display_options: unknown;
  sort_by: string;
  sort_dir: string;
  preset_slot: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  columnId: PulseColumnId;
  presetSlot: ColumnPulsePresetSlot;
  row: ColumnPresetRowDto | null;
  onSaved: () => void;
};

function toggleProtocol(protocols: PulseProtocolId[], id: PulseProtocolId): PulseProtocolId[] {
  const set = new Set(protocols);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return PULSE_PROTOCOL_IDS.filter((p) => set.has(p));
}

function NumField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value == null ? '' : String(value)}
        onChange={(e) => {
          const t = e.target.value.trim();
          if (t === '') {
            onChange(null);
            return;
          }
          const n = Number(t);
          onChange(Number.isFinite(n) ? n : null);
        }}
        className="focus-ring border border-border-subtle bg-transparent px-2 py-1 tabular-nums text-[11px] text-fg-primary"
        placeholder="Any"
      />
      {suffix ? <span className="text-[9px] text-fg-muted">{suffix}</span> : null}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex w-full items-center justify-between rounded-sm border px-2 py-1.5 text-left text-[11px] transition',
        checked
          ? 'border-accent-primary/40 bg-accent-primary/10 text-fg-primary'
          : 'border-border-subtle text-fg-secondary hover:border-border-default',
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums text-fg-muted">{checked ? 'On' : 'Off'}</span>
    </button>
  );
}

export function ColumnFilterModal({
  open,
  onClose,
  columnId,
  presetSlot,
  row,
  onSaved,
}: Props) {
  const { getAccessToken, authenticated } = usePointerAuth();
  const setBuyButtonStyle = usePulseColumnStore((s) => s.setBuyButtonStyle);
  const setQuickBuySol = usePulseColumnStore((s) => s.setQuickBuySol);
  const activeChain = useUIStore((s) => s.activeChain);
  const quoteNativeSymbol = nativeTicker(activeChain);
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>('protocols');
  const [name, setName] = useState('Preset');
  const [filters, setFilters] = useState<ColumnFilters>(DEFAULT_COLUMN_FILTERS);
  const [display, setDisplay] = useState<ColumnDisplayOptions>(DEFAULT_COLUMN_DISPLAY_OPTIONS);
  const [quickSolDraft, setQuickSolDraft] = useState('');
  const [sortBy, setSortBy] = useState<ColumnSortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [importText, setImportText] = useState('');

  const resetDraft = useCallback(() => {
    const qb = usePulseColumnStore.getState().byColumn[columnId].quickBuySol;
    setName(row?.name?.trim() || `P${presetSlot}`);
    setFilters(DEFAULT_COLUMN_FILTERS);
    setDisplay({ ...DEFAULT_COLUMN_DISPLAY_OPTIONS, density: 'normal', quickBuySol: qb });
    setSortBy('created_at');
    setSortDir('desc');
  }, [presetSlot, row?.name, columnId]);

  useEffect(() => {
    if (!open) return;
    /* Hydrate draft when the sheet opens (server row + header density). */
    /* eslint-disable react-hooks/set-state-in-effect -- intentional open transition */
    setTab('protocols');
    setImportText('');
    if (!row) {
      resetDraft();
      return;
    }
    setName(row.name?.trim() || `P${presetSlot}`);
    setFilters(normalizeColumnFilters(row.filters));
    const disp = normalizeColumnDisplayOptions(row.display_options);
    const qb = usePulseColumnStore.getState().byColumn[columnId].quickBuySol;
    setDisplay({ ...disp, density: 'normal', quickBuySol: qb });
    const sb = COLUMN_SORT_KEYS.includes(row.sort_by as ColumnSortKey)
      ? (row.sort_by as ColumnSortKey)
      : 'created_at';
    setSortBy(sb);
    setSortDir(row.sort_dir === 'asc' ? 'asc' : 'desc');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, row, presetSlot, resetDraft, columnId]);

  useEffect(() => {
    if (!open || tab !== 'display') return;
    const q = display.quickBuySol;
    const raf = requestAnimationFrame(() => {
      if (q == null || !Number.isFinite(q) || q <= 0) setQuickSolDraft('');
      else {
        const t = q.toFixed(8).replace(/\.?0+$/, '');
        setQuickSolDraft(t || String(q));
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [open, tab, display.quickBuySol]);

  const sharePayload = useMemo((): ColumnPresetSharePayload | null => {
    try {
      return {
        v: 1,
        column_id: columnId,
        preset_slot: presetSlot,
        name: name.trim() || undefined,
        filters,
        display_options: { ...display, density: 'normal' },
        sort_by: sortBy,
        sort_dir: sortDir,
      };
    } catch {
      return null;
    }
  }, [columnId, presetSlot, name, filters, display, sortBy, sortDir]);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onKey]);

  const saveOne = useMutation({
    mutationFn: async (opts: { applyAll?: boolean }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/pulse/column-presets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          column_id: columnId,
          preset_slot: presetSlot,
          name: name.trim() || `P${presetSlot}`,
          filters,
          display_options: { ...display, density: 'normal' },
          sort_by: sortBy,
          sort_dir: sortDir,
          apply_all_slots: opts.applyAll === true,
        }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const o = typeof json === 'object' && json ? (json as Record<string, unknown>) : {};
        const msg =
          (typeof o.message === 'string' && o.message) ||
          (typeof o.error === 'string' && o.error) ||
          'Save failed';
        throw new Error(msg);
      }
      return json;
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['pulse-column-presets', columnId] });
      toast.success(vars.applyAll ? 'Applied to all presets' : 'Column preset saved');
      onSaved();
      onClose();
    },
    onError: (e) => {
      toast.error('Could not save preset', {
        description: e instanceof Error ? e.message.slice(0, 120) : undefined,
      });
    },
  });

  const exportJson = useCallback(() => {
    const obj = {
      column_id: columnId,
      preset_slot: presetSlot,
      name: name.trim(),
      filters,
      display_options: { ...display, density: 'normal' },
      sort_by: sortBy,
      sort_dir: sortDir,
    };
    return JSON.stringify(obj, null, 2);
  }, [columnId, presetSlot, name, filters, display, sortBy, sortDir]);

  const onImport = useCallback(() => {
    const parsed = parseImportedPresetJson(importText, columnId);
    if (!parsed) {
      toast.error('Invalid JSON');
      return;
    }
    setFilters(parsed.filters);
    setDisplay({ ...normalizeColumnDisplayOptions(parsed.display_options), density: 'normal' });
    setSortBy(parsed.sort_by);
    setSortDir(parsed.sort_dir);
    if (parsed.name) setName(parsed.name);
    toast.success('Imported (apply to save)');
  }, [importText, columnId]);

  const copyShareUrl = useCallback(async () => {
    if (!sharePayload) return;
    const cs = encodeColumnPresetShare(sharePayload);
    const url = `${window.location.origin}/pulse?col=${encodeURIComponent(columnId)}&cs=${encodeURIComponent(cs)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied');
    } catch {
      toast.error('Could not copy');
    }
  }, [sharePayload, columnId]);

  const onShare = useCallback(async () => {
    if (!sharePayload) return;
    const cs = encodeColumnPresetShare(sharePayload);
    const url = `${window.location.origin}/pulse?col=${encodeURIComponent(columnId)}&cs=${encodeURIComponent(cs)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Pointer column preset', url });
        return;
      }
    } catch {
      /* fall through */
    }
    void copyShareUrl();
  }, [sharePayload, columnId, copyShareUrl]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="column-filter-title"
      className="fixed inset-0 z-[90] flex animate-in fade-in items-center justify-center bg-black/55 p-4 backdrop-blur-[6px] duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          'relative flex max-h-[92vh] w-full max-w-lg origin-center animate-in zoom-in-95 fade-in flex-col overflow-hidden shadow-[0_24px_80px_-20px_rgba(0,0,0,0.75)] duration-200',
          'rounded-[11px] border',
        )}
        style={{ backgroundColor: FILTER_MODAL_BG, borderColor: FILTER_MODAL_BORDER }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-md p-1 text-[#6b7280] transition hover:bg-white/[0.06] hover:text-white"
          aria-label="Close filters"
        >
          <X className="h-4 w-4" />
        </button>
        <h2
          id="column-filter-title"
          className="border-b px-4 py-3 pr-10 text-[13px] font-semibold tracking-tight text-white"
          style={{ borderColor: FILTER_MODAL_BORDER }}
        >
          Filters · {columnId}
        </h2>

        <div className="space-y-2 border-b px-4 py-3" style={{ borderColor: FILTER_MODAL_BORDER }}>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">
              Preset name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="focus-ring w-full rounded-[10px] border bg-transparent px-3 py-2 text-[12px] text-white outline-none transition focus:border-[#5865F2]/70"
              style={{ borderColor: FILTER_MODAL_BORDER, backgroundColor: FILTER_FIELD_BG }}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#6b7280]">
            <span className="font-medium">Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ColumnSortKey)}
              className="focus-ring rounded-[10px] border px-2 py-1.5 text-[11px] text-white outline-none"
              style={{ borderColor: FILTER_MODAL_BORDER, backgroundColor: FILTER_FIELD_BG }}
            >
              {COLUMN_SORT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value === 'asc' ? 'asc' : 'desc')}
              className="focus-ring rounded-[10px] border px-2 py-1.5 text-[11px] text-white outline-none"
              style={{ borderColor: FILTER_MODAL_BORDER, backgroundColor: FILTER_FIELD_BG }}
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-border-subtle px-2 pt-2">
          {(
            [
              ['protocols', 'Protocols'],
              ['metrics', 'Metrics'],
              ['social', 'Social'],
              ['display', 'Display'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'btn-press px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide',
                tab === id
                  ? 'border-b-2 border-accent-primary text-accent-primary'
                  : 'text-fg-muted hover:text-fg-secondary',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-[11px]">
          {tab === 'protocols' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {PULSE_PROTOCOL_IDS.map((id) => {
                  const on = filters.protocols.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFilters((f) => ({ ...f, protocols: toggleProtocol(f.protocols, id) }))}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-semibold transition',
                        on
                          ? 'border-accent-primary/50 bg-accent-primary/15 text-accent-primary'
                          : 'border-border-subtle text-fg-muted hover:border-border-default',
                      )}
                    >
                      {PROTOCOL_LABEL[id]}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-press rounded-sm border border-border-subtle px-2 py-1 text-fg-secondary"
                  onClick={() => setFilters((f) => ({ ...f, protocols: [...PULSE_PROTOCOL_IDS] }))}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="btn-press rounded-sm border border-border-subtle px-2 py-1 text-fg-secondary"
                  onClick={() => setFilters((f) => ({ ...f, protocols: [] }))}
                >
                  Unselect all
                </button>
              </div>
              <p className="text-[10px] text-fg-muted">Quote token (when data is available)</p>
              <div className="space-y-1">
                <Toggle label="TON" checked={filters.quoteSol} onChange={(v) => setFilters((f) => ({ ...f, quoteSol: v }))} />
                <Toggle label="USDC" checked={filters.quoteUsdc} onChange={(v) => setFilters((f) => ({ ...f, quoteUsdc: v }))} />
                <Toggle label="USD1" checked={filters.quoteUsd1} onChange={(v) => setFilters((f) => ({ ...f, quoteUsd1: v }))} />
              </div>
            </div>
          ) : null}

          {tab === 'metrics' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <NumField label="MC min ($)" value={filters.mcMin} onChange={(v) => setFilters((f) => ({ ...f, mcMin: v }))} />
                <NumField label="MC max ($)" value={filters.mcMax} onChange={(v) => setFilters((f) => ({ ...f, mcMax: v }))} />
                <NumField label="Liq min ($)" value={filters.liqMin} onChange={(v) => setFilters((f) => ({ ...f, liqMin: v }))} />
                <NumField label="Liq max ($)" value={filters.liqMax} onChange={(v) => setFilters((f) => ({ ...f, liqMax: v }))} />
                <NumField
                  label="Holders min"
                  value={filters.holdersMin}
                  onChange={(v) => setFilters((f) => ({ ...f, holdersMin: v }))}
                />
                <NumField
                  label="Holders max"
                  value={filters.holdersMax}
                  onChange={(v) => setFilters((f) => ({ ...f, holdersMax: v }))}
                />
                <NumField
                  label="Vol 24h min ($)"
                  value={filters.vol24hMin}
                  onChange={(v) => setFilters((f) => ({ ...f, vol24hMin: v }))}
                />
                <NumField
                  label="Vol 24h max ($)"
                  value={filters.vol24hMax}
                  onChange={(v) => setFilters((f) => ({ ...f, vol24hMax: v }))}
                />
                <NumField
                  label="Age min (min)"
                  value={filters.ageMinMinutes}
                  onChange={(v) => setFilters((f) => ({ ...f, ageMinMinutes: v }))}
                />
                <NumField
                  label="Age max (min)"
                  value={filters.ageMaxMinutes}
                  onChange={(v) => setFilters((f) => ({ ...f, ageMaxMinutes: v }))}
                />
                <NumField
                  label="Bonding min %"
                  value={filters.bondingMinPct}
                  onChange={(v) => setFilters((f) => ({ ...f, bondingMinPct: v }))}
                />
                <NumField
                  label="Bonding max %"
                  value={filters.bondingMaxPct}
                  onChange={(v) => setFilters((f) => ({ ...f, bondingMaxPct: v }))}
                />
              </div>
              <Toggle label="Paid only" checked={filters.paidOnly} onChange={(v) => setFilters((f) => ({ ...f, paidOnly: v }))} />
              <Toggle
                label="LP locked only"
                checked={filters.lpLockedOnly}
                onChange={(v) => setFilters((f) => ({ ...f, lpLockedOnly: v }))}
              />
              <Toggle
                label="Mint authority renounced"
                checked={filters.mintRenouncedOnly}
                onChange={(v) => setFilters((f) => ({ ...f, mintRenouncedOnly: v }))}
              />
              <Toggle
                label="Freeze authority renounced"
                checked={filters.freezeRenouncedOnly}
                onChange={(v) => setFilters((f) => ({ ...f, freezeRenouncedOnly: v }))}
              />
            </div>
          ) : null}

          {tab === 'social' ? (
            <div className="space-y-2">
              <Toggle
                label="Has Twitter"
                checked={filters.hasTwitter}
                onChange={(v) => setFilters((f) => ({ ...f, hasTwitter: v }))}
              />
              <Toggle
                label="Has Telegram"
                checked={filters.hasTelegram}
                onChange={(v) => setFilters((f) => ({ ...f, hasTelegram: v }))}
              />
              <Toggle
                label="Has website"
                checked={filters.hasWebsite}
                onChange={(v) => setFilters((f) => ({ ...f, hasWebsite: v }))}
              />
              <NumField
                label="Min Twitter followers"
                value={filters.twitterFollowersMin}
                onChange={(v) => setFilters((f) => ({ ...f, twitterFollowersMin: v }))}
              />
            </div>
          ) : null}

          {tab === 'display' ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Toggle label="Show MC" checked={display.showMc} onChange={(v) => setDisplay((d) => ({ ...d, showMc: v }))} />
                <Toggle label="Show LIQ" checked={display.showLiq} onChange={(v) => setDisplay((d) => ({ ...d, showLiq: v }))} />
                <Toggle label="Show VOL" checked={display.showVol} onChange={(v) => setDisplay((d) => ({ ...d, showVol: v }))} />
                <Toggle
                  label="Show TX (1h)"
                  checked={display.showHolders}
                  onChange={(v) => setDisplay((d) => ({ ...d, showHolders: v }))}
                />
                <Toggle label="Show dev" checked={display.showDev} onChange={(v) => setDisplay((d) => ({ ...d, showDev: v }))} />
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase text-fg-muted">
                  Quick buy ({quoteNativeSymbol}) — this column only
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={quickSolDraft}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/,/g, '.');
                    setQuickSolDraft(raw);
                    const n = parseFloat(raw);
                    if (Number.isFinite(n) && n > 0) {
                      setDisplay((d) => ({ ...d, quickBuySol: n }));
                      setQuickBuySol(columnId, n);
                    }
                  }}
                  className="focus-ring border border-border-subtle bg-transparent px-2 py-1 font-sans text-[12px] font-medium tabular-nums text-fg-primary"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase text-fg-muted">Quick buy button</span>
                <select
                  value={display.buyButtonStyle}
                  onChange={(e) => {
                    const v = e.target.value as BuyButtonStyle;
                    setDisplay((d) => ({ ...d, buyButtonStyle: v }));
                    setBuyButtonStyle(columnId, v);
                  }}
                  className="focus-ring border border-border-subtle bg-bg-base px-2 py-1 text-fg-primary"
                >
                  {BUY_BUTTON_STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s === 'small'
                        ? 'Small — stacked V / MC, compact pill'
                        : s === 'medium'
                          ? 'Medium'
                          : s === 'large'
                            ? 'Large'
                            : 'Ultra (green frame = tap to buy)'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase text-fg-muted">
                  Second button (left of primary)
                </span>
                <select
                  value={display.pulseSecondButton}
                  onChange={(e) => {
                    const v = e.target.value as PulseSecondButtonMode;
                    setDisplay((d) => ({ ...d, pulseSecondButton: v }));
                  }}
                  className="focus-ring border border-border-subtle bg-bg-base px-2 py-1 text-fg-primary"
                >
                  {PULSE_SECOND_BUTTON_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m === 'none'
                        ? 'Off'
                        : m === 'buy'
                          ? `Second buy (separate ${quoteNativeSymbol} amount)`
                          : 'Quick sell (% of balance)'}
                    </option>
                  ))}
                </select>
              </label>
              {display.pulseSecondButton === 'buy' ? (
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase text-fg-muted">
                    Second buy amount ({quoteNativeSymbol})
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      display.secondQuickBuySol != null && Number.isFinite(display.secondQuickBuySol)
                        ? display.secondQuickBuySol.toFixed(8).replace(/\.?0+$/, '')
                        : ''
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, '.');
                      const n = parseFloat(raw);
                      if (Number.isFinite(n) && n > 0) {
                        setDisplay((d) => ({ ...d, secondQuickBuySol: n }));
                      }
                    }}
                    className="focus-ring border border-border-subtle bg-transparent px-2 py-1 font-sans text-[12px] font-medium tabular-nums text-fg-primary"
                  />
                </label>
              ) : null}
              {display.pulseSecondButton === 'sell_pct' ? (
                <NumField
                  label="Sell portion (%)"
                  value={display.secondSellPct}
                  onChange={(v) =>
                    setDisplay((d) => ({
                      ...d,
                      secondSellPct:
                        v != null && v >= 1 && v <= 100 ? Math.round(v) : d.secondSellPct,
                    }))
                  }
                  suffix="1–100"
                />
              ) : null}
              <Toggle
                label="Show risk flags"
                checked={display.showRiskFlags}
                onChange={(v) => setDisplay((d) => ({ ...d, showRiskFlags: v }))}
              />
              <Toggle
                label="Show bonding ring"
                checked={display.showBondingRing}
                onChange={(v) => setDisplay((d) => ({ ...d, showBondingRing: v }))}
              />
              <Toggle
                label="Show launchpad badge"
                checked={display.showLaunchpadBadge}
                onChange={(v) => setDisplay((d) => ({ ...d, showLaunchpadBadge: v }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDisplay((d) => ({ ...d, mcLayout: 'strip' }))}
                  className={cn(
                    'rounded-sm border px-2 py-1.5 text-[11px] transition',
                    display.mcLayout === 'strip'
                      ? 'border-accent-primary/40 bg-accent-primary/10 text-fg-primary'
                      : 'border-border-subtle text-fg-secondary',
                  )}
                >
                  MC compact
                </button>
                <button
                  type="button"
                  onClick={() => setDisplay((d) => ({ ...d, mcLayout: 'hero' }))}
                  className={cn(
                    'rounded-sm border px-2 py-1.5 text-[11px] transition',
                    display.mcLayout === 'hero'
                      ? 'border-accent-primary/40 bg-accent-primary/10 text-fg-primary'
                      : 'border-border-subtle text-fg-secondary',
                  )}
                >
                  MC large
                </button>
              </div>
              <Toggle
                label="Pump frame (on-curve)"
                checked={display.showPumpFrame}
                onChange={(v) => setDisplay((d) => ({ ...d, showPumpFrame: v }))}
              />
              <Toggle
                label="Trait icons (cashback / agent / fee share)"
                checked={display.showTraitIcons}
                onChange={(v) => setDisplay((d) => ({ ...d, showTraitIcons: v }))}
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-border-subtle bg-bg-base px-4 py-3">
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Paste JSON to import..."
            className="focus-ring h-16 w-full resize-y border border-border-subtle bg-transparent p-2 tabular-nums text-[10px] text-fg-primary"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-press rounded-sm border border-border-subtle px-2 py-1 text-[10px] text-fg-secondary"
              onClick={() => {
                void navigator.clipboard.writeText(exportJson()).catch(() => toast.error('Copy failed'));
                toast.success('Exported JSON copied');
              }}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="btn-press rounded-sm border border-border-subtle px-2 py-1 text-[10px] text-fg-secondary"
              onClick={onImport}
            >
              Import
            </button>
            <button
              type="button"
              className="btn-press flex items-center gap-1 rounded-sm border border-border-subtle px-2 py-1 text-[10px] text-fg-secondary"
              onClick={() => void onShare()}
            >
              <Share2 className="h-3 w-3" />
              Share
            </button>
            <button
              type="button"
              className="btn-press rounded-sm border border-border-subtle px-2 py-1 text-[10px] text-fg-secondary"
              onClick={() => void copyShareUrl()}
            >
              Copy link
            </button>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-border-subtle pt-3">
            <button
              type="button"
              className="btn-press rounded-sm border border-border-subtle px-3 py-1.5 text-[11px] text-fg-secondary"
              onClick={resetDraft}
            >
              Reset
            </button>
            <button
              type="button"
              disabled={!authenticated || saveOne.isPending}
              className="btn-press rounded-sm border border-border-subtle px-3 py-1.5 text-[11px] text-fg-secondary disabled:opacity-50"
              onClick={() => saveOne.mutate({ applyAll: true })}
            >
              Apply all slots
            </button>
            <button
              type="button"
              disabled={!authenticated || saveOne.isPending}
              className="btn-press rounded-sm bg-accent-primary px-3 py-1.5 text-[11px] font-medium text-fg-inverse disabled:opacity-50"
              onClick={() => saveOne.mutate({ applyAll: false })}
            >
              Apply
            </button>
          </div>
          {!authenticated ? (
            <p className="text-[10px] text-fg-muted">Sign in to save column presets to your account.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
