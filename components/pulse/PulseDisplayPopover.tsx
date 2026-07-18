'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ExternalLink,
  Eye,
  Hash,
  LayoutList,
  LineChart,
  LoaderCircle,
  MousePointerClick,
  Search,
  Sparkles,
  SquareDashed,
  Zap,
} from 'lucide-react';
import { PulseAccentColorPicker } from '@/components/pulse/PulseAccentColorPicker';
import { pulsePillBtnCls } from '@/components/pulse/pulseToolbarStyles';
import {
  pulseDisplayProtocolColor,
  pulseDisplayProtocolIdsForChain,
  pulseDisplayProtocolLabel,
} from '@/components/pulse/pulseDisplayProtocols';
import { PrefToggle } from '@/components/preferences/controls';
import { SettingsPopoverPortal } from '@/components/ui/SettingsPopoverPortal';
import { useOverlayPresence, SETTINGS_POPOVER_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import type { BuyButtonStyle } from '@/lib/tokens/columnPresetModel';
import type { ProtocolBrandId } from '@/lib/tokens/protocolBrand';
import { BUY_BUTTON_STYLES } from '@/lib/tokens/columnPresetModel';
import { MetricBandEditor } from '@/components/pulse/MetricBandEditor';
import { ProtocolColorPicker } from '@/components/pulse/ProtocolColorPicker';
import { ProtocolBrandIcon } from '@/components/tokens/ProtocolBrandIcon';
import {
  DEFAULT_METRIC_BAND_COLORS,
  type PulseDisplayTab,
  type QuickBuyUltraChrome,
} from '@/lib/preferences/pulseDisplay';
import {
  getConsensusQuickBuyFromColumns,
  usePulseDisplayPrefsStore,
} from '@/store/pulseDisplayPrefs';
import { usePulseColumnStore } from '@/store/pulseColumns';
import { usePulseHiddenMintsStore } from '@/store/pulseHiddenMints';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';
const TABS: { id: PulseDisplayTab; label: string }[] = [
  { id: 'layout', label: 'Layout' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'row', label: 'Row' },
  { id: 'extras', label: 'Extras' },
];

const QUICK_BUY_LABELS: Record<BuyButtonStyle, string> = {
  small: 'Small',
  medium: 'Large',
  large: 'Mega',
  ultra: 'Ultra',
};

const QUICK_BUY_CHROME: { id: QuickBuyUltraChrome; label: string }[] = [
  { id: 'outline', label: 'Border' },
  { id: 'filled', label: 'Filled' },
  { id: 'borderless', label: 'No border' },
];

const PANEL_SURFACE =
  'border border-white/[0.08] bg-bg-raised shadow-[0_32px_90px_-40px_rgba(0,0,0,0.9)]';
const PANEL_DIVIDER = 'border-border-subtle/80';
const CHIP_IDLE =
  'border-border-subtle bg-bg-sunken/40 text-fg-muted hover:border-border-default hover:bg-bg-hover/50 hover:text-fg-secondary';
const CHIP_ACTIVE = 'border-accent-primary/45 bg-accent-primary/10 text-fg-primary';

function TopChip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'btn-press flex min-h-[2.25rem] flex-1 items-center justify-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition',
        active ? CHIP_ACTIVE : CHIP_IDLE,
        className,
      )}
    >
      {children}
    </button>
  );
}

function MiniChartSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-2.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] text-fg-secondary">{label}</span>
        <span className="text-[11px] font-semibold tabular-nums text-fg-primary">
          {Math.round(value)}%
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-bg-hover accent-accent-primary"
      />
    </div>
  );
}

function LayoutToggleRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        'flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-[12px] transition',
        value
          ? CHIP_ACTIVE
          : cn(CHIP_IDLE, 'bg-transparent text-fg-secondary'),
      )}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-fg-muted">{icon}</span>
      <span className="flex-1">{label}</span>
      <span
        className={cn(
          'h-3.5 w-3.5 shrink-0 rounded-full border',
          value ? 'border-accent-primary bg-accent-primary' : 'border-white/20',
        )}
        aria-hidden
      />
    </button>
  );
}

/** Axiom-style Pulse Display panel (tabs: Layout / Metrics / Row / Extras). */
export function PulseDisplayPopover() {
  const [open, setOpen] = useState(false);
  const { mounted, visible } = useOverlayPresence(open, SETTINGS_POPOVER_ANIM_CLOSE_MS);
  const prefs = usePulseDisplayPrefsStore();
  const setPrefs = usePulseDisplayPrefsStore((s) => s.setPrefs);
  const resetPrefs = usePulseDisplayPrefsStore((s) => s.resetPrefs);
  const hydrateQuickBuyFromColumns = usePulseDisplayPrefsStore((s) => s.hydrateQuickBuyFromColumns);
  const byColumn = usePulseColumnStore((s) => s.byColumn);
  const { displayQuickBuySol, quickBuyButtonSize } = useMemo(
    () => getConsensusQuickBuyFromColumns(byColumn),
    [byColumn],
  );

  const showHidden = usePulseHiddenMintsStore((s) => s.showHiddenTokens);
  const unhideOnMigration = usePulseHiddenMintsStore((s) => s.unhideOnMigration);
  const setShowHidden = usePulseHiddenMintsStore((s) => s.setShowHiddenTokens);
  const setUnhideOnMigration = usePulseHiddenMintsStore((s) => s.setUnhideOnMigration);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, right: 0 });
  const [selectedProtocolId, setSelectedProtocolId] = useState<ProtocolBrandId | null>(null);
  const activeChain = useUIStore((s) => s.activeChain);
  const displayProtocolIds = useMemo(
    () => pulseDisplayProtocolIdsForChain(activeChain),
    [activeChain],
  );

  function updatePosition() {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
  }

  useLayoutEffect(() => {
    if (!mounted || !visible) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [mounted, visible]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    hydrateQuickBuyFromColumns();
  }, [open, displayQuickBuySol, quickBuyButtonSize, hydrateQuickBuyFromColumns]);

  useEffect(() => {
    setSelectedProtocolId((prev) =>
      prev && displayProtocolIds.includes(prev) ? prev : null,
    );
  }, [activeChain, displayProtocolIds]);

  const mcPreview = prefs.mcMetricSize === 'large' ? '77K' : '77K';

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Display"
        className={cn(pulsePillBtnCls, open && 'border-white/[0.12] bg-bg-hover/75 text-fg-primary')}
      >
        <LayoutList className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        <span>Display</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-fg-muted" strokeWidth={2.25} aria-hidden />
      </button>

      <SettingsPopoverPortal
        mounted={mounted}
        visible={visible}
        onClose={() => setOpen(false)}
        popoverRef={popoverRef}
        aria-label="Pulse display"
        panelClassName={cn(
          'flex w-[min(26rem,calc(100vw-1rem))] max-h-[min(85vh,40rem)] flex-col overflow-hidden rounded-xl',
          PANEL_SURFACE,
        )}
        style={{ top: coords.top, right: coords.right }}
      >
            <div className={cn('shrink-0 space-y-2 border-b p-3', PANEL_DIVIDER)}>
              <div className="flex gap-1.5">
                <TopChip
                  active={prefs.mcMetricSize === 'small'}
                  onClick={() => setPrefs({ mcMetricSize: 'small' })}
                >
                  MC {mcPreview} Small
                </TopChip>
                <TopChip
                  active={prefs.mcMetricSize === 'large'}
                  onClick={() => setPrefs({ mcMetricSize: 'large' })}
                >
                  MC {mcPreview} Large
                </TopChip>
              </div>

              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                  Quick buy
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {BUY_BUTTON_STYLES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPrefs({ quickBuyButtonSize: size })}
                      className={cn(
                        'flex flex-col items-center gap-0.5 rounded-md border py-1.5 text-[10px] font-semibold transition',
                        quickBuyButtonSize === size ? 'bg-bg-sunken/50 text-fg-primary' : CHIP_IDLE,
                      )}
                      style={
                        quickBuyButtonSize === size
                          ? { borderColor: `${prefs.accentHex}66` }
                          : undefined
                      }
                    >
                      <span className="inline-flex items-center gap-0.5">
                        <Zap className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                        <span className="tabular-nums">{displayQuickBuySol}</span>
                      </span>
                      {QUICK_BUY_LABELS[size]}
                    </button>
                  ))}
                </div>
              </div>

              <PulseAccentColorPicker
                color={prefs.accentHex}
                onChange={(hex) => setPrefs({ accentHex: hex })}
              />

              <PulseAccentColorPicker
                label="Toast color"
                color={prefs.toastColor ?? '#0f1319'}
                onChange={(hex) => setPrefs({ toastColor: hex })}
                onReset={() => setPrefs({ toastColor: null })}
                resetTitle="Reset to default dark"
              />

              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                  Quick buy style
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {QUICK_BUY_CHROME.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPrefs({ quickBuyUltraChrome: id })}
                      className={cn(
                        'flex items-center justify-center gap-1 rounded-md border py-1.5 text-[10px] font-semibold transition',
                        prefs.quickBuyUltraChrome === id
                          ? 'bg-bg-sunken/50 text-fg-primary'
                          : CHIP_IDLE,
                      )}
                      style={
                        prefs.quickBuyUltraChrome === id
                          ? { borderColor: `${prefs.accentHex}66` }
                          : undefined
                      }
                    >
                      <Zap className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={cn('flex shrink-0 gap-0.5 border-b bg-bg-base/30 px-2 py-1.5', PANEL_DIVIDER)}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPrefs({ activeTab: t.id })}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                    prefs.activeTab === t.id
                      ? 'bg-bg-hover text-fg-primary'
                      : 'text-fg-muted hover:bg-bg-hover/40 hover:text-fg-secondary',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {prefs.activeTab === 'layout' ? (
                <div className="space-y-2">
                  <LayoutToggleRow
                    icon={<Search className="h-3.5 w-3.5" />}
                    label="Hide search bar"
                    value={prefs.hideColumnSearch}
                    onChange={(v) => setPrefs({ hideColumnSearch: v })}
                  />
                  <LayoutToggleRow
                    icon={<Hash className="h-3.5 w-3.5" />}
                    label="No decimals"
                    value={prefs.noDecimals}
                    onChange={(v) => setPrefs({ noDecimals: v })}
                  />
                  <LayoutToggleRow
                    icon={<Eye className="h-3.5 w-3.5" />}
                    label="Show hidden tokens"
                    value={showHidden}
                    onChange={setShowHidden}
                  />
                  <LayoutToggleRow
                    icon={<Eye className="h-3 w-3 opacity-70" />}
                    label="Unhide on migrated"
                    value={unhideOnMigration}
                    onChange={setUnhideOnMigration}
                  />
                  <LayoutToggleRow
                    icon={<LoaderCircle className="h-3.5 w-3.5" />}
                    label="Circle images"
                    value={prefs.circleAvatars}
                    onChange={(v) => setPrefs({ circleAvatars: v })}
                  />
                  <LayoutToggleRow
                    icon={<LoaderCircle className="h-3.5 w-3.5" />}
                    label="Progress bar"
                    value={prefs.showBondingProgress}
                    onChange={(v) => setPrefs({ showBondingProgress: v })}
                  />
                  <LayoutToggleRow
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                    label="Detailed token hover"
                    value={prefs.tokenHoverDetail}
                    onChange={(v) => setPrefs({ tokenHoverDetail: v })}
                  />
                  <LayoutToggleRow
                    icon={<SquareDashed className="h-3.5 w-3.5" />}
                    label="Transparent rows"
                    value={prefs.transparentRows}
                    onChange={(v) => setPrefs({ transparentRows: v })}
                  />

                  <div className="mt-2 rounded-lg border border-border-subtle/60 bg-bg-sunken/30 p-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                      <LineChart className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      Mini chart
                    </p>
                    <p className="mt-2 text-[10px] font-medium text-fg-muted">Show in tables</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(
                        [
                          ['new', 'New Pairs'],
                          ['stretch', 'Final Stretch'],
                          ['migrated', 'Migrated'],
                        ] as const
                      ).map(([key, label]) => {
                        const on = prefs.miniChart.columns[key];
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() =>
                              setPrefs({
                                miniChart: {
                                  ...prefs.miniChart,
                                  columns: { ...prefs.miniChart.columns, [key]: !on },
                                },
                              })
                            }
                            className={cn(
                              'rounded-md border px-2 py-1 text-[11px] font-medium transition',
                              on ? CHIP_ACTIVE : CHIP_IDLE,
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <MiniChartSlider
                      label="Chart size"
                      value={prefs.miniChart.size}
                      min={10}
                      max={100}
                      onChange={(v) => setPrefs({ miniChart: { ...prefs.miniChart, size: v } })}
                    />
                    <MiniChartSlider
                      label="Chart opacity"
                      value={prefs.miniChart.opacity}
                      min={0}
                      max={100}
                      onChange={(v) => setPrefs({ miniChart: { ...prefs.miniChart, opacity: v } })}
                    />
                    <MiniChartSlider
                      label="Edge fade"
                      value={prefs.miniChart.edgeFade}
                      min={0}
                      max={100}
                      onChange={(v) => setPrefs({ miniChart: { ...prefs.miniChart, edgeFade: v } })}
                    />
                  </div>

                  <p className="pt-2 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                    Customize rows
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        ['twitterHandle', 'Twitter handle'],
                        ['twitterFollowing', 'Twitter following'],
                        ['twitterFollowers', 'Twitter followers'],
                        ['imageReuse', 'Image reuse'],
                        ['marketCap', 'Market cap'],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setPrefs({
                            rowFields: { ...prefs.rowFields, [key]: !prefs.rowFields[key] },
                          })
                        }
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-medium transition',
                          prefs.rowFields[key]
                            ? 'border-accent-primary/40 bg-accent-primary/10 text-accent-primary'
                            : cn(CHIP_IDLE, 'rounded-full'),
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {prefs.activeTab === 'metrics' ? (
                <div className="space-y-3">
                  <MetricBandEditor
                    title="Market cap"
                    band={prefs.metricBands.marketCap}
                    defaultColors={DEFAULT_METRIC_BAND_COLORS.marketCap}
                    valueMode="usd"
                    onChange={(marketCap) => setPrefs({ metricBands: { ...prefs.metricBands, marketCap } })}
                  />
                  <MetricBandEditor
                    title="Volume"
                    band={prefs.metricBands.volume}
                    defaultColors={DEFAULT_METRIC_BAND_COLORS.volume}
                    valueMode="usd"
                    onChange={(volume) => setPrefs({ metricBands: { ...prefs.metricBands, volume } })}
                  />
                  <MetricBandEditor
                    title="Holders"
                    band={prefs.metricBands.holders}
                    defaultColors={DEFAULT_METRIC_BAND_COLORS.holders}
                    valueMode="plain"
                    onChange={(holders) => setPrefs({ metricBands: { ...prefs.metricBands, holders } })}
                  />
                  <MetricBandEditor
                    title="Tweet age"
                    band={prefs.metricBands.tweetAgeMinutes}
                    defaultColors={DEFAULT_METRIC_BAND_COLORS.tweetAgeMinutes}
                    valueMode="minutes"
                    unitSuffix="m"
                    onChange={(tweetAgeMinutes) =>
                      setPrefs({ metricBands: { ...prefs.metricBands, tweetAgeMinutes } })
                    }
                  />
                  <p className="text-[10px] text-fg-muted">
                    Threshold colors apply to V / MC highlights when Color row is on.
                  </p>
                </div>
              ) : null}

              {prefs.activeTab === 'row' ? (
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                    Normal row
                  </p>
                  <p className="text-[11px] leading-snug text-fg-muted">
                    Default card surface when protocol tinting is off or the launchpad is disabled below.
                  </p>
                  <PrefToggle
                    label="Color row"
                    description="Tint rows by launchpad protocol instead of the normal row."
                    value={prefs.colorRowByProtocol}
                    onChange={(v) => setPrefs({ colorRowByProtocol: v })}
                  />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                    Protocol row colors
                  </p>
                  <p className="text-[11px] leading-snug text-fg-muted">
                    Select a launchpad, then tune its row tint. Colors are saved to your display prefs.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {displayProtocolIds.map((id) => {
                      const on = prefs.protocolRowColors[id] ?? false;
                      const brandColor = pulseDisplayProtocolColor(id);
                      const swatchColor = prefs.protocolColorHex[id] ?? brandColor;
                      const selected = selectedProtocolId === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setSelectedProtocolId(id);
                            if (!on) {
                              setPrefs({
                                protocolRowColors: { ...prefs.protocolRowColors, [id]: true },
                              });
                            }
                          }}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold transition',
                            on
                              ? selected
                                ? 'bg-bg-hover/50'
                                : 'border-border-default bg-bg-hover/25'
                              : cn(CHIP_IDLE, 'opacity-45'),
                          )}
                          style={
                            on
                              ? {
                                  borderColor: selected ? swatchColor : `${swatchColor}66`,
                                  color: swatchColor,
                                }
                              : undefined
                          }
                        >
                          <ProtocolBrandIcon protocolId={id} dotClassName="h-3.5 w-3.5" />
                          <span className="min-w-0 truncate">{pulseDisplayProtocolLabel(id)}</span>
                        </button>
                      );
                    })}
                  </div>
                  {(() => {
                    const activeId =
                      selectedProtocolId ??
                      displayProtocolIds.find((id) => prefs.protocolRowColors[id]) ??
                      displayProtocolIds[0];
                    if (!activeId) return null;
                    const brandColor = pulseDisplayProtocolColor(activeId);
                    const swatchColor = prefs.protocolColorHex[activeId] ?? brandColor;
                    const enabled = prefs.protocolRowColors[activeId] ?? false;
                    return (
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-fg-secondary">
                          {pulseDisplayProtocolLabel(activeId)}
                        </p>
                        <PrefToggle
                          label="Enabled"
                          description="Tint rows for this launchpad."
                          value={enabled}
                          onChange={(v) =>
                            setPrefs({
                              protocolRowColors: {
                                ...prefs.protocolRowColors,
                                [activeId]: v,
                              },
                            })
                          }
                        />
                        <ProtocolColorPicker
                          color={swatchColor}
                          defaultColor={brandColor}
                          onChange={(hex) =>
                            setPrefs({
                              protocolColorHex: {
                                ...prefs.protocolColorHex,
                                [activeId]: hex,
                              },
                            })
                          }
                          onReset={() => {
                            const next = { ...prefs.protocolColorHex };
                            delete next[activeId];
                            setPrefs({ protocolColorHex: next });
                          }}
                        />
                      </div>
                    );
                  })()}
                </div>
              ) : null}

              {prefs.activeTab === 'extras' ? (
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                    Table layout
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(
                      [
                        ['new', 'New pairs'],
                        ['stretch', 'Final stretch'],
                        ['migrated', 'Migrated'],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setPrefs({
                            visibleColumns: {
                              ...prefs.visibleColumns,
                              [key]: !prefs.visibleColumns[key],
                            },
                          })
                        }
                        className={cn(
                          'rounded-md border px-2 py-1 text-[10px] font-medium transition',
                          prefs.visibleColumns[key]
                            ? 'border-accent-primary/50 text-accent-primary'
                            : cn(CHIP_IDLE, 'rounded-full'),
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                    Click quick buy
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        ['nothing', 'Nothing', MousePointerClick],
                        ['open_page', 'Open page', Zap],
                        ['new_tab', 'New tab', ExternalLink],
                      ] as const
                    ).map(([val, label, Icon]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setPrefs({ quickBuyClickBehavior: val })}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-md border py-2 text-[10px] font-medium transition',
                          prefs.quickBuyClickBehavior === val
                            ? 'border-accent-primary/40 bg-accent-primary/10 text-accent-primary'
                            : cn(CHIP_IDLE, 'rounded-full'),
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                        {label}
                      </button>
                    ))}
                  </div>

                  <PrefToggle
                    label="Wallet groups in header"
                    description="Show the wallet pill in the Pulse toolbar."
                    value={prefs.walletGroupsInHeader}
                    onChange={(v) => setPrefs({ walletGroupsInHeader: v })}
                  />

                  <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                    Second button
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {(['off', 'buy', 'sell'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPrefs({ secondButtonMode: mode })}
                        className={cn(
                          'rounded-md border py-1.5 text-[10px] font-semibold capitalize transition',
                          prefs.secondButtonMode === mode
                            ? 'border-accent-primary/40 bg-accent-primary/10 text-accent-primary'
                            : cn(CHIP_IDLE, 'rounded-full'),
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                </div>
              ) : null}
            </div>

            <div className={cn('flex shrink-0 items-center justify-end gap-2 border-t bg-bg-base/30 px-3 py-2', PANEL_DIVIDER)}>
              <button
                type="button"
                onClick={resetPrefs}
                className="text-[10px] uppercase tracking-wide text-fg-muted hover:text-fg-secondary"
              >
                Reset
              </button>
            </div>
      </SettingsPopoverPortal>
    </div>
  );
}
