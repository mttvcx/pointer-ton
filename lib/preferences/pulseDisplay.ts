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

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const MetricBandColorsSchema = z.tuple([HexColorSchema, HexColorSchema, HexColorSchema]);

export const MetricBandSchema = z.object({
  low: z.number().nonnegative(),
  mid: z.number().nonnegative(),
  highMode: z.enum(['above', 'below']),
  /** Tier colors: [0 → low], (low → mid], (mid → ∞) when `highMode` is `above`. */
  colors: MetricBandColorsSchema,
});

export type MetricBand = z.infer<typeof MetricBandSchema>;
export type MetricBandColors = z.infer<typeof MetricBandColorsSchema>;

export type MetricBandKey = keyof PulseDisplayPrefs['metricBands'];

/** Default tier swatches per metric (Axiom-style). */
export const DEFAULT_METRIC_BAND_COLORS: Record<MetricBandKey, MetricBandColors> = {
  marketCap: ['#52C5FF', '#F5B800', '#00C27A'],
  volume: ['#D4D4D8', '#D4D4D8', '#D4D4D8'],
  holders: ['#D4D4D8', '#D4D4D8', '#D4D4D8'],
  tweetAgeMinutes: ['#00C27A', '#F7931A', '#EF4444'],
};

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
  /** Optional per-protocol row tint overrides (hex). Falls back to brand color. */
  protocolColorHex: z.record(z.string(), HexColorSchema),
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

const defaultMetricBand = (key: MetricBandKey): MetricBand => ({
  low: 0,
  mid: 0,
  highMode: 'above',
  colors: [...DEFAULT_METRIC_BAND_COLORS[key]],
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
    marketCap: {
      low: 30_000,
      mid: 150_000,
      highMode: 'above',
      colors: [...DEFAULT_METRIC_BAND_COLORS.marketCap],
    },
    volume: {
      low: 1_000,
      mid: 2_000,
      highMode: 'above',
      colors: [...DEFAULT_METRIC_BAND_COLORS.volume],
    },
    holders: {
      low: 10,
      mid: 50,
      highMode: 'above',
      colors: [...DEFAULT_METRIC_BAND_COLORS.holders],
    },
    tweetAgeMinutes: {
      low: 10,
      mid: 60,
      highMode: 'above',
      colors: [...DEFAULT_METRIC_BAND_COLORS.tweetAgeMinutes],
    },
  },
  colorRowByProtocol: false,
  protocolColorHex: {},
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
      marketCap: {
        ...defaultMetricBand('marketCap'),
        ...base.metricBands?.marketCap,
        colors: base.metricBands?.marketCap?.colors ?? [...DEFAULT_METRIC_BAND_COLORS.marketCap],
      },
      volume: {
        ...defaultMetricBand('volume'),
        ...base.metricBands?.volume,
        colors: base.metricBands?.volume?.colors ?? [...DEFAULT_METRIC_BAND_COLORS.volume],
      },
      holders: {
        ...defaultMetricBand('holders'),
        ...base.metricBands?.holders,
        colors: base.metricBands?.holders?.colors ?? [...DEFAULT_METRIC_BAND_COLORS.holders],
      },
      tweetAgeMinutes: {
        ...defaultMetricBand('tweetAgeMinutes'),
        ...base.metricBands?.tweetAgeMinutes,
        colors:
          base.metricBands?.tweetAgeMinutes?.colors ?? [...DEFAULT_METRIC_BAND_COLORS.tweetAgeMinutes],
      },
    },
    visibleColumns: { ...DEFAULT_PULSE_DISPLAY_PREFS.visibleColumns, ...base.visibleColumns },
    protocolRowColors: {
      ...DEFAULT_PULSE_DISPLAY_PREFS.protocolRowColors,
      ...base.protocolRowColors,
    },
    protocolColorHex: {
      ...DEFAULT_PULSE_DISPLAY_PREFS.protocolColorHex,
      ...base.protocolColorHex,
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
    protocolColorHex,
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
    protocolColorHex,
    visibleColumns,
    quickBuyClickBehavior,
    walletGroupsInHeader,
    secondButtonMode,
    accentHex,
  });
}
