'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Share2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { PulseColumnId } from '@/lib/utils/constants';
import { PULSE_COLUMNS } from '@/lib/utils/constants';
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
  countActiveColumnFilters,
  defaultColumnFiltersForChain,
  encodeColumnPresetShare,
  normalizeColumnDisplayOptions,
  normalizeColumnFilters,
  parseImportedPresetJson,
} from '@/lib/tokens/columnPresetModel';
import {
  pulseProtocolAccentColor,
  pulseProtocolPresetIdsForChain,
} from '@/lib/tokens/pulseProtocolRegistry';
import { protocolBrand } from '@/lib/tokens/protocolBrand';
import type { ColumnPulsePresetSlot } from '@/store/pulseColumns';
import { usePulseColumnStore } from '@/store/pulseColumns';
import { useUIStore } from '@/store/ui';
import {
  modalBackdropClass,
  modalBtnPrimaryClass,
  modalBtnSecondaryClass,
  modalCloseBtnClass,
  modalInputClass,
  modalPanelClass,
  modalScopeTabClass,
  modalSectionLabelClass,
} from '@/lib/ui/modalChrome';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import type { AppChainId } from '@/lib/chains/appChain';
import { cn } from '@/lib/utils/cn';
import { ProtocolBrandIcon, QuoteTokenIcon } from '@/components/tokens/ProtocolBrandIcon';

const SORT_LABELS: Record<ColumnSortKey, string> = {
  created_at: 'Age (created)',
  market_cap_usd: 'Market cap',
  liquidity_usd: 'Liquidity',
  holder_count: 'Holders',
  volume_24h_usd: 'Volume 24h',
  age_minutes: 'Age (minutes)',
  bonding_curve_pct: 'Bonding %',
};

const SCOPE_LABELS: Record<PulseColumnId, string> = {
  new: 'New Pairs',
  stretch: 'Final Stretch',
  migrated: 'Migrated',
};

type SectionTabId = 'protocols' | 'audit' | 'metrics' | 'socials';

const SECTION_TABS: { id: SectionTabId; label: string }[] = [
  { id: 'protocols', label: 'Protocols' },
  { id: 'audit', label: 'Audit' },
  { id: 'metrics', label: '$ Metrics' },
  { id: 'socials', label: 'Socials' },
];

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
  /** Live row preview while the modal is open (before Apply). */
  onDisplayPreview?: (patch: Partial<ColumnDisplayOptions>) => void;
};

function toggleProtocol(
  chain: Parameters<typeof pulseProtocolPresetIdsForChain>[0],
  protocols: string[],
  id: string,
): string[] {
  const presetIds = pulseProtocolPresetIdsForChain(chain);
  const set = new Set(protocols);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return [...presetIds].filter((p) => set.has(p));
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
    <label className="flex flex-col gap-1">
      <span className={modalSectionLabelClass}>{label}</span>
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
        className={modalInputClass}
        placeholder="Any"
      />
      {suffix ? <span className="text-[9px] text-fg-muted">{suffix}</span> : null}
    </label>
  );
}

function AuditToggle({
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
        'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[12px] transition',
        checked
          ? 'border-accent-primary/40 bg-accent-primary/10 text-fg-primary'
          : 'border-border-subtle bg-bg-sunken text-fg-secondary hover:border-border-default hover:text-fg-primary',
      )}
    >
      <span>{label}</span>
      <span className="text-[11px] text-fg-muted">{checked ? 'On' : 'Off'}</span>
    </button>
  );
}

function ProtocolPill({
  id,
  label,
  selected,
  onToggle,
}: {
  id: string;
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const color = pulseProtocolAccentColor(id);
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] transition-all',
        selected ? 'text-fg-primary' : 'border-border-subtle bg-bg-sunken text-fg-muted',
      )}
      style={
        selected
          ? {
              borderColor: `${color}99`,
              backgroundColor: `${color}26`,
            }
          : undefined
      }
    >
      <ProtocolBrandIcon protocolId={id} />
      <span>{label}</span>
    </button>
  );
}

function QuotePill({
  kind,
  label,
  selected,
  chain,
  onToggle,
}: {
  kind: 'native' | 'usdc' | 'usd1';
  label: string;
  selected: boolean;
  chain: AppChainId;
  onToggle: () => void;
}) {
  const nativeAccent =
    chain === 'bnb'
      ? { on: 'border-yellow-500/40 bg-yellow-500/15 text-yellow-400', off: 'border-white/[0.08] bg-white/[0.03] text-white/50' }
      : chain === 'ton'
        ? { on: 'border-sky-400/40 bg-sky-400/15 text-sky-300', off: 'border-white/[0.08] bg-white/[0.03] text-white/50' }
        : chain === 'base'
          ? { on: 'border-blue-500/40 bg-blue-500/15 text-blue-300', off: 'border-white/[0.08] bg-white/[0.03] text-white/50' }
          : { on: 'border-[#9945ff]/40 bg-[#9945ff]/15 text-[#9945ff]', off: 'border-white/[0.08] bg-white/[0.03] text-white/50' };

  const styles =
    kind === 'native'
      ? nativeAccent
      : kind === 'usdc'
        ? {
            on: 'border-[#2775ca]/40 bg-[#2775ca]/15 text-[#2775ca]',
            off: 'border-white/[0.08] bg-white/[0.03] text-white/50',
          }
        : {
            on: 'border-yellow-500/40 bg-yellow-500/15 text-yellow-400',
            off: 'border-white/[0.08] bg-white/[0.03] text-white/50',
          };

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] transition-all',
        selected ? styles.on : styles.off,
      )}
    >
      <QuoteTokenIcon kind={kind} chain={chain} />
      <span>{label}</span>
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
  onDisplayPreview,
}: Props) {
  const { getAccessToken, authenticated } = usePointerAuth();
  const setBuyButtonStyle = usePulseColumnStore((s) => s.setBuyButtonStyle);
  const setLocalColumnFilters = usePulseColumnStore((s) => s.setLocalColumnFilters);
  const setQuickBuySol = usePulseColumnStore((s) => s.setQuickBuySol);
  const activeChain = useUIStore((s) => s.activeChain);
  const quoteNativeSymbol = nativeTicker(activeChain);
  const qc = useQueryClient();

  const [scopeColumn, setScopeColumn] = useState<PulseColumnId>(columnId);
  const [sectionTab, setSectionTab] = useState<SectionTabId>('protocols');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [searchKeywords, setSearchKeywords] = useState('');
  const [excludeKeywords, setExcludeKeywords] = useState('');

  const [name, setName] = useState('Preset');
  const [filters, setFilters] = useState<ColumnFilters>(() => defaultColumnFiltersForChain(activeChain));
  const [display, setDisplay] = useState<ColumnDisplayOptions>(DEFAULT_COLUMN_DISPLAY_OPTIONS);
  const [quickSolDraft, setQuickSolDraft] = useState('');
  const [sortBy, setSortBy] = useState<ColumnSortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [importText, setImportText] = useState('');

  const scopePresetSlot = usePulseColumnStore((s) => s.byColumn[scopeColumn].presetSlot);

  useEffect(() => {
    if (open) setScopeColumn(columnId);
  }, [open, columnId]);

  const scopePresetsQueries = useQueries({
    queries: PULSE_COLUMNS.map((col) => ({
      queryKey: ['pulse-column-presets', col],
      queryFn: async (): Promise<{ presets: ColumnPresetRowDto[] }> => {
        const token = await getAccessToken();
        if (!token) return { presets: [] };
        const r = await fetch(`/api/pulse/column-presets?column_id=${col}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return { presets: [] };
        return r.json() as Promise<{ presets: ColumnPresetRowDto[] }>;
      },
      enabled: open && authenticated,
      staleTime: 30_000,
    })),
  });

  const activeRow = useMemo(() => {
    if (scopeColumn === columnId && scopePresetSlot === presetSlot && row) return row;
    const idx = PULSE_COLUMNS.indexOf(scopeColumn);
    const data = scopePresetsQueries[idx]?.data;
    if (!data?.presets?.length) return null;
    return data.presets.find((p) => p.preset_slot === scopePresetSlot) ?? null;
  }, [scopeColumn, columnId, scopePresetSlot, presetSlot, row, scopePresetsQueries]);

  const resetDraft = useCallback(() => {
    const chain = useUIStore.getState().activeChain;
    const qb = usePulseColumnStore.getState().byColumn[scopeColumn].quickBuySol;
    setName(activeRow?.name?.trim() || `P${scopePresetSlot}`);
    setFilters(defaultColumnFiltersForChain(chain));
    setDisplay({ ...DEFAULT_COLUMN_DISPLAY_OPTIONS, density: 'normal', quickBuySol: qb });
    setSortBy('created_at');
    setSortDir('desc');
    setSearchKeywords('');
    setExcludeKeywords('');
  }, [scopeColumn, scopePresetSlot, activeRow?.name]);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate on open / scope change */
    setSectionTab('protocols');
    setImportText('');
    if (!activeRow) {
      resetDraft();
      return;
    }
    setName(activeRow.name?.trim() || `P${scopePresetSlot}`);
    setFilters(normalizeColumnFilters(activeRow.filters, activeChain));
    const disp = normalizeColumnDisplayOptions(activeRow.display_options);
    const qb = usePulseColumnStore.getState().byColumn[scopeColumn].quickBuySol;
    setDisplay({ ...disp, density: 'normal', quickBuySol: qb });
    const sb = COLUMN_SORT_KEYS.includes(activeRow.sort_by as ColumnSortKey)
      ? (activeRow.sort_by as ColumnSortKey)
      : 'created_at';
    setSortBy(sb);
    setSortDir(activeRow.sort_dir === 'asc' ? 'asc' : 'desc');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, activeRow, scopePresetSlot, resetDraft, scopeColumn, activeChain]);

  useEffect(() => {
    if (!open) return;
    setFilters((f) => normalizeColumnFilters({ ...f }, activeChain));
  }, [activeChain, open]);

  useEffect(() => {
    if (!open || sectionTab !== 'socials' || advancedOpen) return;
    const q = display.quickBuySol;
    const raf = requestAnimationFrame(() => {
      if (q == null || !Number.isFinite(q) || q <= 0) setQuickSolDraft('');
      else {
        const t = q.toFixed(8).replace(/\.?0+$/, '');
        setQuickSolDraft(t || String(q));
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [open, sectionTab, advancedOpen, display.quickBuySol]);

  const scopeFilterCounts = useMemo(() => {
    const counts: Record<PulseColumnId, number> = { new: 0, stretch: 0, migrated: 0 };
    PULSE_COLUMNS.forEach((col, i) => {
      if (col === scopeColumn) {
        counts[col] = countActiveColumnFilters(filters, activeChain);
        return;
      }
      const data = scopePresetsQueries[i]?.data;
      const slot = usePulseColumnStore.getState().byColumn[col].presetSlot;
      const r = data?.presets?.find((p) => p.preset_slot === slot);
      const f = r
        ? normalizeColumnFilters(r.filters, activeChain)
        : defaultColumnFiltersForChain(activeChain);
      counts[col] = countActiveColumnFilters(f, activeChain);
    });
    return counts;
  }, [scopeColumn, filters, activeChain, scopePresetsQueries]);

  const sharePayload = useMemo((): ColumnPresetSharePayload | null => {
    try {
      return {
        v: 1,
        column_id: scopeColumn,
        preset_slot: scopePresetSlot,
        name: name.trim() || undefined,
        filters,
        display_options: { ...display, density: 'normal' },
        sort_by: sortBy,
        sort_dir: sortDir,
      };
    } catch {
      return null;
    }
  }, [scopeColumn, scopePresetSlot, name, filters, display, sortBy, sortDir]);

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
    mutationFn: async (opts: { allColumns?: boolean }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const body = {
        preset_slot: scopePresetSlot,
        name: name.trim() || `P${scopePresetSlot}`,
        filters,
        display_options: { ...display, density: 'normal' },
        sort_by: sortBy,
        sort_dir: sortDir,
      };

      const columns = opts.allColumns === true ? [...PULSE_COLUMNS] : [scopeColumn];

      for (const col of columns) {
        const res = await fetch('/api/pulse/column-presets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...body,
            column_id: col,
            apply_all_slots: opts.allColumns === true,
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
      }

      return { allColumns: opts.allColumns === true };
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['pulse-column-presets'] });
      toast.success(vars.allColumns ? 'Applied to all columns' : 'Applied to this column');
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
      column_id: scopeColumn,
      preset_slot: scopePresetSlot,
      name: name.trim(),
      filters,
      display_options: { ...display, density: 'normal' },
      sort_by: sortBy,
      sort_dir: sortDir,
    };
    return JSON.stringify(obj, null, 2);
  }, [scopeColumn, scopePresetSlot, name, filters, display, sortBy, sortDir]);

  const onImport = useCallback(() => {
    const parsed = parseImportedPresetJson(importText, scopeColumn, activeChain);
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
  }, [importText, scopeColumn, activeChain]);

  const copyShareUrl = useCallback(async () => {
    if (!sharePayload) return;
    const cs = encodeColumnPresetShare(sharePayload);
    const url = `${window.location.origin}/pulse?col=${encodeURIComponent(scopeColumn)}&cs=${encodeURIComponent(cs)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied');
    } catch {
      toast.error('Could not copy');
    }
  }, [sharePayload, scopeColumn]);

  const onShare = useCallback(async () => {
    if (!sharePayload) return;
    const cs = encodeColumnPresetShare(sharePayload);
    const url = `${window.location.origin}/pulse?col=${encodeURIComponent(scopeColumn)}&cs=${encodeURIComponent(cs)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Pointer column preset', url });
        return;
      }
    } catch {
      /* fall through */
    }
    void copyShareUrl();
  }, [sharePayload, scopeColumn, copyShareUrl]);

  const protocolIds = pulseProtocolPresetIdsForChain(activeChain);
  const { mounted, visible } = useOverlayPresence(open);

  if (!mounted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="column-filter-title"
      className={cn('fixed inset-0 flex items-center justify-center p-4', Z_APP_MODAL_OVERLAY)}
      onMouseDown={(e) => {
        const t = e.target as HTMLElement | null;
        if (!t || t.closest('[data-modal-panel]')) return;
        onClose();
      }}
    >
      <button
        type="button"
        aria-label="Close filters"
        className={cn(modalBackdropClass, overlayBackdropClasses(visible))}
        onClick={onClose}
      />
      <div
        data-modal-panel
        className={cn(
          modalPanelClass,
          'max-h-[90vh] w-full max-w-[480px]',
          overlayPanelClasses(visible),
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 id="column-filter-title" className="text-sm font-semibold text-fg-primary">
            Filters
          </h2>
          <button type="button" onClick={onClose} className={modalCloseBtnClass} aria-label="Close filters">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Column scope tabs */}
        <div className="flex shrink-0 gap-3 border-b border-border-subtle px-4 pb-0 pt-2">
          {PULSE_COLUMNS.map((col) => {
            const active = scopeColumn === col;
            const count = scopeFilterCounts[col];
            return (
              <button
                key={col}
                type="button"
                onClick={() => setScopeColumn(col)}
                className={modalScopeTabClass(active)}
              >
                {SCOPE_LABELS[col]}
                {count > 0 ? (
                  <span className="rounded-sm border border-border-subtle bg-bg-sunken px-1.5 text-[10px] tabular-nums text-fg-muted">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Keyword row (UI-only until backend supports keywords) */}
        <div className="grid shrink-0 grid-cols-2 gap-3 px-4 py-3">
          <label className="flex flex-col">
            <span className={cn('mb-1', modalSectionLabelClass)}>Search Keywords</span>
            <input
              value={searchKeywords}
              onChange={(e) => setSearchKeywords(e.target.value)}
              placeholder="keyword1, keyword2..."
              className={modalInputClass}
            />
          </label>
          <label className="flex flex-col">
            <span className={cn('mb-1', modalSectionLabelClass)}>Exclude Keywords</span>
            <input
              value={excludeKeywords}
              onChange={(e) => setExcludeKeywords(e.target.value)}
              placeholder="keyword1, keyword2..."
              className={modalInputClass}
            />
          </label>
        </div>

        {/* Section tabs */}
        <div className="flex shrink-0 gap-4 border-b border-border-subtle px-4 pt-2">
          {SECTION_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSectionTab(id)}
              className={modalScopeTabClass(sectionTab === id)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-[11px]">
          {sectionTab === 'protocols' ? (
            <div>
              <p className="mb-3 text-[11px] leading-snug text-white/40">
                Protocol presets follow the{' '}
                <span className="font-medium text-white">{quoteNativeSymbol}</span> header chain. Switch chain in
                the top bar to see other venues.
              </p>
              <div className="flex flex-wrap gap-2">
                {protocolIds.map((id) => {
                  const protos = filters.protocols as readonly string[];
                  const on = protos.includes(id);
                  const label = protocolBrand(id)?.label ?? id;
                  return (
                    <ProtocolPill
                      key={id}
                      id={id}
                      label={label}
                      selected={on}
                      onToggle={() =>
                        setFilters((f) => ({
                          ...f,
                          protocols: toggleProtocol(activeChain, f.protocols, id),
                        }))
                      }
                    />
                  );
                })}
              </div>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  className="text-[11px] text-white/50 transition hover:text-white/80"
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      protocols: [...pulseProtocolPresetIdsForChain(activeChain)],
                    }))
                  }
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="text-[11px] text-white/50 transition hover:text-white/80"
                  onClick={() => setFilters((f) => ({ ...f, protocols: [] }))}
                >
                  Unselect all
                </button>
              </div>

              <p className="mt-4 mb-2 text-[10px] uppercase tracking-widest text-white/30">Quote Tokens</p>
              <div className="flex flex-wrap gap-2">
                {activeChain === 'eth' ? (
                  <>
                    <QuotePill
                      kind="native"
                      label="ETH"
                      chain={activeChain}
                      selected={filters.quoteSol}
                      onToggle={() => setFilters((f) => ({ ...f, quoteSol: !f.quoteSol }))}
                    />
                    <QuotePill
                      kind="native"
                      label="WETH"
                      chain={activeChain}
                      selected={filters.quoteWeth}
                      onToggle={() => setFilters((f) => ({ ...f, quoteWeth: !f.quoteWeth }))}
                    />
                    <QuotePill
                      kind="usdc"
                      label="USDC"
                      chain={activeChain}
                      selected={filters.quoteUsdc}
                      onToggle={() => setFilters((f) => ({ ...f, quoteUsdc: !f.quoteUsdc }))}
                    />
                    <QuotePill
                      kind="usdc"
                      label="USDT"
                      chain={activeChain}
                      selected={filters.quoteUsdt}
                      onToggle={() => setFilters((f) => ({ ...f, quoteUsdt: !f.quoteUsdt }))}
                    />
                    <QuotePill
                      kind="usd1"
                      label="VIRTUAL"
                      chain={activeChain}
                      selected={filters.quoteVirtual}
                      onToggle={() => setFilters((f) => ({ ...f, quoteVirtual: !f.quoteVirtual }))}
                    />
                    <QuotePill
                      kind="usd1"
                      label="OTHER"
                      chain={activeChain}
                      selected={filters.quoteOther}
                      onToggle={() => setFilters((f) => ({ ...f, quoteOther: !f.quoteOther }))}
                    />
                  </>
                ) : (
                  <>
                    <QuotePill
                      kind="native"
                      label={quoteNativeSymbol}
                      chain={activeChain}
                      selected={filters.quoteSol}
                      onToggle={() => setFilters((f) => ({ ...f, quoteSol: !f.quoteSol }))}
                    />
                    <QuotePill
                      kind="usdc"
                      label="USDC"
                      chain={activeChain}
                      selected={filters.quoteUsdc}
                      onToggle={() => setFilters((f) => ({ ...f, quoteUsdc: !f.quoteUsdc }))}
                    />
                    <QuotePill
                      kind="usd1"
                      label="USD1"
                      chain={activeChain}
                      selected={filters.quoteUsd1}
                      onToggle={() => setFilters((f) => ({ ...f, quoteUsd1: !f.quoteUsd1 }))}
                    />
                  </>
                )}
              </div>
            </div>
          ) : null}

          {sectionTab === 'audit' ? (
            <div className="space-y-2">
              <AuditToggle label="Paid only" checked={filters.paidOnly} onChange={(v) => setFilters((f) => ({ ...f, paidOnly: v }))} />
              <AuditToggle
                label="LP locked only"
                checked={filters.lpLockedOnly}
                onChange={(v) => setFilters((f) => ({ ...f, lpLockedOnly: v }))}
              />
              <AuditToggle
                label="Mint authority renounced"
                checked={filters.mintRenouncedOnly}
                onChange={(v) => setFilters((f) => ({ ...f, mintRenouncedOnly: v }))}
              />
              <AuditToggle
                label="Freeze authority renounced"
                checked={filters.freezeRenouncedOnly}
                onChange={(v) => setFilters((f) => ({ ...f, freezeRenouncedOnly: v }))}
              />
            </div>
          ) : null}

          {sectionTab === 'metrics' ? (
            <div className="grid grid-cols-2 gap-3">
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
          ) : null}

          {sectionTab === 'socials' ? (
            <div className="space-y-2">
              <AuditToggle
                label="Has Twitter"
                checked={filters.hasTwitter}
                onChange={(v) => setFilters((f) => ({ ...f, hasTwitter: v }))}
              />
              <AuditToggle
                label="Has Telegram"
                checked={filters.hasTelegram}
                onChange={(v) => setFilters((f) => ({ ...f, hasTelegram: v }))}
              />
              <AuditToggle
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
        </div>

        {/* Advanced (preset name, sort, display, JSON) */}
        <div className="shrink-0 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-2.5 text-[11px] text-white/40 transition hover:text-white/60"
          >
            <span className="uppercase tracking-widest">Advanced</span>
            <ChevronDown className={cn('h-3.5 w-3.5 transition', advancedOpen && 'rotate-180')} />
          </button>
          {advancedOpen ? (
            <div className="max-h-[200px] space-y-3 overflow-y-auto border-t border-white/[0.04] px-5 py-3">
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wide text-white/40">Preset name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 outline-none"
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-white/40">Sort</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as ColumnSortKey)}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.04] px-2 py-1.5 text-[11px] text-white outline-none"
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
                  className="rounded-lg border border-white/[0.06] bg-white/[0.04] px-2 py-1.5 text-[11px] text-white outline-none"
                >
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste JSON to import..."
                className="h-16 w-full resize-y rounded-lg border border-white/[0.06] bg-white/[0.04] p-2 text-[10px] text-white/80 outline-none"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-white/[0.06] px-2 py-1 text-[10px] text-white/50 hover:text-white/80"
                  onClick={() => {
                    void navigator.clipboard.writeText(exportJson()).catch(() => toast.error('Copy failed'));
                    toast.success('Exported JSON copied');
                  }}
                >
                  Export JSON
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/[0.06] px-2 py-1 text-[10px] text-white/50 hover:text-white/80"
                  onClick={onImport}
                >
                  Import
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-lg border border-white/[0.06] px-2 py-1 text-[10px] text-white/50 hover:text-white/80"
                  onClick={() => void copyShareUrl()}
                >
                  Copy link
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <AuditToggle label="Show MC" checked={display.showMc} onChange={(v) => setDisplay((d) => ({ ...d, showMc: v }))} />
                <AuditToggle label="Show LIQ" checked={display.showLiq} onChange={(v) => setDisplay((d) => ({ ...d, showLiq: v }))} />
                <AuditToggle label="Show VOL" checked={display.showVol} onChange={(v) => setDisplay((d) => ({ ...d, showVol: v }))} />
                <AuditToggle
                  label="Show TX (1h)"
                  checked={display.showHolders}
                  onChange={(v) => setDisplay((d) => ({ ...d, showHolders: v }))}
                />
                <AuditToggle label="Show dev" checked={display.showDev} onChange={(v) => setDisplay((d) => ({ ...d, showDev: v }))} />
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase text-white/40">
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
                      setQuickBuySol(scopeColumn, n);
                    }
                  }}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase text-white/40">Quick buy button</span>
                <select
                  value={display.buyButtonStyle}
                  onChange={(e) => {
                    const v = e.target.value as BuyButtonStyle;
                    setDisplay((d) => ({ ...d, buyButtonStyle: v }));
                    setBuyButtonStyle(scopeColumn, v);
                  }}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.04] px-2 py-1.5 text-[11px] text-white outline-none"
                >
                  {BUY_BUTTON_STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase text-white/40">Second button</span>
                <select
                  value={display.pulseSecondButton}
                  onChange={(e) => {
                    const v = e.target.value as PulseSecondButtonMode;
                    setDisplay((d) => ({ ...d, pulseSecondButton: v }));
                    onDisplayPreview?.({ pulseSecondButton: v });
                  }}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.04] px-2 py-1.5 text-[11px] text-white outline-none"
                >
                  {PULSE_SECOND_BUTTON_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-border-subtle px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="rounded-sm px-2 py-1 text-[12px] text-fg-muted transition hover:bg-bg-hover hover:text-fg-secondary"
              onClick={onImport}
            >
              Import
            </button>
            <button
              type="button"
              className="rounded-sm px-2 py-1 text-[12px] text-fg-muted transition hover:bg-bg-hover hover:text-fg-secondary"
              onClick={() => {
                void navigator.clipboard.writeText(exportJson()).catch(() => toast.error('Copy failed'));
                toast.success('Exported JSON copied');
              }}
            >
              Export
            </button>
            <button
              type="button"
              className="flex items-center gap-1 rounded-sm px-2 py-1 text-[12px] text-fg-muted transition hover:bg-bg-hover hover:text-fg-secondary"
              onClick={() => void onShare()}
            >
              <Share2 className="h-3 w-3" />
              Share
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={modalBtnSecondaryClass}
              onClick={resetDraft}
            >
              Reset
            </button>
            <button
              type="button"
              disabled={saveOne.isPending}
              className={modalBtnSecondaryClass}
              onClick={() => {
                if (authenticated) {
                  saveOne.mutate({ allColumns: false });
                  return;
                }
                setLocalColumnFilters(scopeColumn, scopePresetSlot, filters);
                toast.success('Applied to this column');
                onSaved();
                onClose();
              }}
            >
              Apply
            </button>
            <button
              type="button"
              disabled={saveOne.isPending}
              className={modalBtnPrimaryClass}
              onClick={() => {
                if (authenticated) {
                  saveOne.mutate({ allColumns: true });
                  return;
                }
                for (const col of PULSE_COLUMNS) {
                  for (const slot of [1, 2, 3] as const) {
                    setLocalColumnFilters(col, slot, filters);
                  }
                }
                toast.success('Applied to all columns');
                onSaved();
                onClose();
              }}
            >
              Apply All
            </button>
          </div>
        </div>
        {!authenticated ? (
          <p className="px-5 pb-3 text-center text-[10px] text-white/35">
            Filters apply locally on this device. Sign in to sync presets across sessions.
          </p>
        ) : null}
      </div>
    </div>
  );
}
