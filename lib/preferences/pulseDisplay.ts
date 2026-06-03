import { z } from 'zod';
import type { BuyButtonStyle } from '@/lib/tokens/columnPresetModel';
import { BUY_BUTTON_STYLES } from '@/lib/tokens/columnPresetModel';

export const PulseDisplayTabSchema = z.enum(['layout', 'metrics', 'row', 'extras']);
export type PulseDisplayTab = z.infer<typeof PulseDisplayTabSchema>;

export const McMetricSizeSchema = z.enum(['small', 'large']);
export type McMetricSize = z.infer<typeof McMetricSizeSchema>;

export const QuickBuyClickBehaviorSchema = z.enum(['nothing', 'open_page', 'new_tab']);
export type QuickBuyClickBehavior = z.infer<typeof QuickBuyClickBehaviorSchema>;

export const PulseSecondButtonModeSchema = z.enum(['off', 'buy', 'sell']);
export type PulseSecondButtonMode = z.infer<typeof PulseSecondButtonModeSchema>;

export const MetricBandSchema = z.object({
  low: z.number().nonnegative(),
  mid: z.number().nonnegative(),
  highMode: z.enum(['above', 'below']),
});

export type MetricBand = z.infer<typeof MetricBandSchema>;

export const PulseDisplayPrefsSchema = z.object({
  activeTab: PulseDisplayTabSchema,
  mcMetricSize: McMetricSizeSchema,
  quickBuyButtonSize: z.enum(BUY_BUTTON_STYLES),
  /** Shown on Display quick-buy chips; synced to all column header amounts. */
  displayQuickBuySol: z.number().positive().max(1_000_000),
  compactTables: z.boolean(),
  hideColumnSearch: z.boolean(),
  noDecimals: z.boolean(),
  circleAvatars: z.boolean(),
  showBondingProgress: z.boolean(),
  rowFields: z.object({
    twitterHandle: z.boolean(),
    twitterFollowing: z.boolean(),
    twitterFollowers: z.boolean(),
    imageReuse: z.boolean(),
    marketCap: z.boolean(),
  }),
  metricBands: z.object({
    marketCap: MetricBandSchema,
    volume: MetricBandSchema,
    holders: MetricBandSchema,
    tweetAgeMinutes: MetricBandSchema,
  }),
  colorRowByProtocol: z.boolean(),
  /** Protocol brand ids enabled for row tinting. */
  protocolRowColors: z.record(z.string(), z.boolean()),
  visibleColumns: z.object({
    new: z.boolean(),
    stretch: z.boolean(),
    migrated: z.boolean(),
  }),
  quickBuyClickBehavior: QuickBuyClickBehaviorSchema,
  walletGroupsInHeader: z.boolean(),
  secondButtonMode: PulseSecondButtonModeSchema,
  accentHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export type PulseDisplayPrefs = z.infer<typeof PulseDisplayPrefsSchema>;

export const PULSE_DISPLAY_STORAGE_KEY = 'pointer.pulse-display';

const defaultMetricBand = (): MetricBand => ({
  low: 0,
  mid: 0,
  highMode: 'above',
});

export const DEFAULT_PULSE_DISPLAY_PREFS: PulseDisplayPrefs = {
  activeTab: 'layout',
  mcMetricSize: 'large',
  quickBuyButtonSize: 'large',
  displayQuickBuySol: 0.5,
  compactTables: false,
  hideColumnSearch: false,
  noDecimals: false,
  circleAvatars: false,
  showBondingProgress: true,
  rowFields: {
    twitterHandle: true,
    twitterFollowing: true,
    twitterFollowers: true,
    imageReuse: true,
    marketCap: true,
  },
  metricBands: {
    marketCap: { low: 30_000, mid: 150_000, highMode: 'above' },
    volume: { low: 1_000, mid: 2_000, highMode: 'above' },
    holders: { low: 10, mid: 50, highMode: 'above' },
    tweetAgeMinutes: { low: 10, mid: 60, highMode: 'above' },
  },
  colorRowByProtocol: false,
  protocolRowColors: {
    'pump.fun': true,
    bonk: true,
    moonshot: true,
    bags: true,
    mayhem: true,
    soar: true,
    'jupiter-studio': true,
  },
  visibleColumns: { new: true, stretch: true, migrated: true },
  quickBuyClickBehavior: 'nothing',
  walletGroupsInHeader: true,
  secondButtonMode: 'off',
  accentHex: '#526EEE',
};

export function withPulseDisplayDefaults(
  input: Partial<PulseDisplayPrefs> | null | undefined,
): PulseDisplayPrefs {
  const base = { ...DEFAULT_PULSE_DISPLAY_PREFS, ...(input ?? {}) };
  return PulseDisplayPrefsSchema.parse({
    ...base,
    rowFields: { ...DEFAULT_PULSE_DISPLAY_PREFS.rowFields, ...base.rowFields },
    metricBands: {
      marketCap: { ...defaultMetricBand(), ...base.metricBands?.marketCap },
      volume: { ...defaultMetricBand(), ...base.metricBands?.volume },
      holders: { ...defaultMetricBand(), ...base.metricBands?.holders },
      tweetAgeMinutes: { ...defaultMetricBand(), ...base.metricBands?.tweetAgeMinutes },
    },
    visibleColumns: { ...DEFAULT_PULSE_DISPLAY_PREFS.visibleColumns, ...base.visibleColumns },
    protocolRowColors: {
      ...DEFAULT_PULSE_DISPLAY_PREFS.protocolRowColors,
      ...base.protocolRowColors,
    },
  });
}

export function mcMetricSizeToLayout(size: McMetricSize): 'hero' | 'strip' {
  return size === 'large' ? 'hero' : 'strip';
}

export function secondButtonToPreset(mode: PulseSecondButtonMode): 'none' | 'buy' | 'sell_pct' {
  if (mode === 'buy') return 'buy';
  if (mode === 'sell') return 'sell_pct';
  return 'none';
}

/** Strip zustand actions before merge/parse. */
export function pickPulseDisplayPrefs(state: Partial<PulseDisplayPrefs> & Record<string, unknown>): PulseDisplayPrefs {
  const {
    activeTab,
    mcMetricSize,
    quickBuyButtonSize,
    displayQuickBuySol,
    compactTables,
    hideColumnSearch,
    noDecimals,
    circleAvatars,
    showBondingProgress,
    rowFields,
    metricBands,
    colorRowByProtocol,
    protocolRowColors,
    visibleColumns,
    quickBuyClickBehavior,
    walletGroupsInHeader,
    secondButtonMode,
    accentHex,
  } = state;
  return withPulseDisplayDefaults({
    activeTab,
    mcMetricSize,
    quickBuyButtonSize,
    displayQuickBuySol,
    compactTables,
    hideColumnSearch,
    noDecimals,
    circleAvatars,
    showBondingProgress,
    rowFields,
    metricBands,
    colorRowByProtocol,
    protocolRowColors,
    visibleColumns,
    quickBuyClickBehavior,
    walletGroupsInHeader,
    secondButtonMode,
    accentHex,
  });
}
