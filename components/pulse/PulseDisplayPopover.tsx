'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ExternalLink,
  Eye,
  Grid2x2,
  Hash,
  LayoutList,
  LoaderCircle,
  MousePointerClick,
  Search,
  Sun,
  Zap,
} from 'lucide-react';
import { pulsePillBtnCls } from '@/components/pulse/pulseToolbarStyles';
import {
  PULSE_DISPLAY_PROTOCOL_IDS,
  pulseDisplayProtocolColor,
  pulseDisplayProtocolLabel,
} from '@/components/pulse/pulseDisplayProtocols';
import { PrefToggle } from '@/components/preferences/controls';
import { useOverlayPresence, POPOVER_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import type { BuyButtonStyle } from '@/lib/tokens/columnPresetModel';
import { BUY_BUTTON_STYLES } from '@/lib/tokens/columnPresetModel';
import type { PulseDisplayTab, MetricBand } from '@/lib/preferences/pulseDisplay';
import { popoverPanelClasses } from '@/lib/ui/overlayMotion';
import { PortalToBody } from '@/lib/ui/portalToBody';
import { usePulseDisplayPrefsStore } from '@/store/pulseDisplayPrefs';
import { usePulseHiddenMintsStore } from '@/store/pulseHiddenMints';
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
        active
          ? 'border-white/[0.18] bg-white/[0.1] text-fg-primary'
          : 'border-white/[0.08] bg-transparent text-fg-muted hover:border-white/[0.12] hover:text-fg-secondary',
        className,
      )}
    >
      {children}
    </button>
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
          ? 'border-accent-primary/35 bg-accent-primary/[0.08] text-fg-primary'
          : 'border-white/[0.08] bg-transparent text-fg-secondary hover:border-white/[0.12]',
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

function MetricBandEditor({
  title,
  band,
  onChange,
  units,
}: {
  title: string;
  band: MetricBand;
  onChange: (b: MetricBand) => void;
  units?: string;
}) {
  const swatches = ['bg-blue-500', 'bg-amber-400', 'bg-emerald-500'] as const;
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">{title}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {(['low', 'mid'] as const).map((key, i) => (
          <label key={key} className="relative block">
            <input
              type="number"
              min={0}
              value={band[key]}
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                if (Number.isFinite(n) && n >= 0) onChange({ ...band, [key]: n });
              }}
              className="w-full rounded-md border border-white/[0.08] bg-bg-sunken py-1.5 pl-2 pr-6 font-mono text-[11px] text-fg-primary"
            />
            <span
              className={cn('pointer-events-none absolute bottom-1.5 right-1.5 h-2 w-2 rounded-sm', swatches[i])}
              aria-hidden
            />
          </label>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              ...band,
              highMode: band.highMode === 'above' ? 'below' : 'above',
            })
          }
          className="flex items-center justify-center gap-1 rounded-md border border-white/[0.08] bg-bg-sunken py-1.5 text-[10px] font-medium text-fg-secondary"
        >
          <span className={cn('h-2 w-2 rounded-sm', swatches[2])} aria-hidden />
          {band.highMode === 'above' ? 'Above' : 'Below'}
          {units ? <span className="text-fg-muted">{units}</span> : null}
        </button>
      </div>
    </div>
  );
}

/** Axiom-style Pulse Display panel (tabs: Layout / Metrics / Row / Extras). */
export function PulseDisplayPopover() {
  const [open, setOpen] = useState(false);
  const { mounted, visible } = useOverlayPresence(open, POPOVER_ANIM_CLOSE_MS);
  const prefs = usePulseDisplayPrefsStore();
  const setPrefs = usePulseDisplayPrefsStore((s) => s.setPrefs);
  const resetPrefs = usePulseDisplayPrefsStore((s) => s.resetPrefs);

  const showHidden = usePulseHiddenMintsStore((s) => s.showHiddenTokens);
  const unhideOnMigration = usePulseHiddenMintsStore((s) => s.unhideOnMigration);
  const setShowHidden = usePulseHiddenMintsStore((s) => s.setShowHiddenTokens);
  const setUnhideOnMigration = usePulseHiddenMintsStore((s) => s.setUnhideOnMigration);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, right: 0 });

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
    function onMouse(e: MouseEvent) {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener('mousedown', onMouse);
    return () => window.removeEventListener('mousedown', onMouse);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

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

      {mounted ? (
        <PortalToBody>
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Pulse display"
            className={cn(
              'fixed z-[200] flex w-[min(26rem,calc(100vw-1rem))] max-h-[min(85vh,40rem)] flex-col overflow-hidden rounded-lg border border-white/[0.1] bg-[#141414] shadow-2xl',
              popoverPanelClasses(visible),
            )}
            style={{ top: coords.top, right: coords.right }}
          >
            <div className="shrink-0 space-y-2 border-b border-white/[0.06] p-3">
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
                        prefs.quickBuyButtonSize === size
                          ? 'border-accent-primary bg-accent-primary/15 text-accent-primary'
                          : 'border-white/[0.08] text-fg-muted hover:border-white/[0.12]',
                      )}
                    >
                      <span className="inline-flex items-center gap-0.5">
                        <Zap className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                        <span className="tabular-nums">{prefs.displayQuickBuySol}</span>
                      </span>
                      {QUICK_BUY_LABELS[size]}
                    </button>
                  ))}
                </div>
                <label className="mt-1.5 flex items-center gap-2 text-[11px] text-fg-muted">
                  <span>Amount</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={prefs.displayQuickBuySol}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value);
                      if (Number.isFinite(n) && n > 0) setPrefs({ displayQuickBuySol: n });
                    }}
                    className="w-20 rounded-md border border-white/[0.08] bg-bg-sunken px-2 py-0.5 font-mono text-xs text-fg-primary"
                  />
                  <span>SOL</span>
                </label>
              </div>

              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[12px] text-fg-muted"
                title="Theme presets live in Settings"
              >
                <Sun className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                Grey
              </button>
            </div>

            <div className="flex shrink-0 gap-0.5 border-b border-white/[0.06] px-2 py-1.5">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPrefs({ activeTab: t.id })}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                    prefs.activeTab === t.id
                      ? 'bg-white/[0.1] text-fg-primary'
                      : 'text-fg-muted hover:text-fg-secondary',
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
                    icon={<Grid2x2 className="h-3.5 w-3.5" />}
                    label="Compact tables"
                    value={prefs.compactTables}
                    onChange={(v) => setPrefs({ compactTables: v })}
                  />
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
                            : 'border-white/[0.08] text-fg-muted',
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
                    onChange={(marketCap) => setPrefs({ metricBands: { ...prefs.metricBands, marketCap } })}
                  />
                  <MetricBandEditor
                    title="Volume"
                    band={prefs.metricBands.volume}
                    onChange={(volume) => setPrefs({ metricBands: { ...prefs.metricBands, volume } })}
                  />
                  <MetricBandEditor
                    title="Holders"
                    band={prefs.metricBands.holders}
                    onChange={(holders) => setPrefs({ metricBands: { ...prefs.metricBands, holders } })}
                  />
                  <MetricBandEditor
                    title="Tweet age"
                    band={prefs.metricBands.tweetAgeMinutes}
                    units="m"
                    onChange={(tweetAgeMinutes) =>
                      setPrefs({ metricBands: { ...prefs.metricBands, tweetAgeMinutes } })
                    }
                  />
                  <p className="text-[10px] text-fg-muted">
                    Threshold colors apply to metric highlights. {/* TODO Phase 2: row metric coloring */}
                  </p>
                </div>
              ) : null}

              {prefs.activeTab === 'row' ? (
                <div className="space-y-3">
                  <PrefToggle
                    label="Color row"
                    description="Tint rows by launchpad protocol."
                    value={prefs.colorRowByProtocol}
                    onChange={(v) => setPrefs({ colorRowByProtocol: v })}
                  />
                  <div className="flex flex-wrap gap-1">
                    {PULSE_DISPLAY_PROTOCOL_IDS.map((id) => {
                      const on = prefs.protocolRowColors[id] ?? false;
                      const color = pulseDisplayProtocolColor(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() =>
                            setPrefs({
                              protocolRowColors: {
                                ...prefs.protocolRowColors,
                                [id]: !on,
                              },
                            })
                          }
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition',
                            on ? 'border-white/20' : 'border-white/[0.06] opacity-50',
                          )}
                          style={on ? { borderColor: `${color}66`, color } : undefined}
                        >
                          {pulseDisplayProtocolLabel(id)}
                        </button>
                      );
                    })}
                  </div>
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
                            : 'border-white/[0.08] text-fg-muted',
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
                            : 'border-white/[0.08] text-fg-muted',
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
                            : 'border-white/[0.08] text-fg-muted',
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>

                  <label className="flex items-center gap-2 text-[11px] text-fg-muted">
                    Accent
                    <input
                      type="color"
                      value={prefs.accentHex}
                      onChange={(e) => setPrefs({ accentHex: e.target.value })}
                      className="h-7 w-10 cursor-pointer rounded border border-white/[0.08] bg-transparent"
                    />
                    <span className="font-mono text-fg-secondary">{prefs.accentHex}</span>
                  </label>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/[0.06] px-3 py-2">
              <button
                type="button"
                onClick={resetPrefs}
                className="text-[10px] uppercase tracking-wide text-fg-muted hover:text-fg-secondary"
              >
                Reset
              </button>
            </div>
          </div>
        </PortalToBody>
      ) : null}
    </div>
  );
}
