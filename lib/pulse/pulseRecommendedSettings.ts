import type { AppChainId } from '@/lib/chains/appChain';
import { supportedFilterIdsForChain } from '@/lib/protocol/registry';
import {
  DEFAULT_COLUMN_DISPLAY_OPTIONS,
  type ColumnDisplayOptions,
  type ColumnFilters,
  defaultColumnFiltersForChain,
} from '@/lib/tokens/columnPresetModel';
import type { PulseDisplayPrefs } from '@/lib/preferences/pulseDisplay';
import { withPulseDisplayDefaults } from '@/lib/preferences/pulseDisplay';
import type { PulseColumnId } from '@/lib/utils/constants';

/** Popular launch venues per chain — only backend-supported classifier ids. */
export const RECOMMENDED_PROTOCOL_IDS: Record<AppChainId, readonly string[]> = {
  sol: ['pump.fun', 'bonk', 'moonshot', 'bags', 'mayhem', 'heaven', 'dynamic-bc'],
  ton: ['ton'],
  eth: ['eth', 'uniswap-v3'],
  bnb: ['bsc', 'pancakeswap'],
  base: ['base'],
};

export const PULSE_RECOMMENDED_CHECKLIST = [
  'Focus on supported launch platforms with backend classification',
  'Filter out new tokens with a low market cap',
  'Optimized display to show essential info on Pulse',
] as const;

function allowedProtocols(chain: AppChainId): string[] {
  const allowed = new Set(supportedFilterIdsForChain(chain));
  return RECOMMENDED_PROTOCOL_IDS[chain].filter((id) => allowed.has(id));
}

/** Column filters tuned per Pulse board (new / stretch / migrated). */
export function recommendedColumnFilters(
  chain: AppChainId,
  column: PulseColumnId,
): ColumnFilters {
  const base = defaultColumnFiltersForChain(chain);
  const protocols = allowedProtocols(chain);
  const common: ColumnFilters = {
    ...base,
    protocols,
    quoteSol: true,
    quoteUsdc: true,
    quoteUsd1: true,
    paidOnly: false,
    lpLockedOnly: false,
    mintRenouncedOnly: false,
    freezeRenouncedOnly: false,
    hasTwitter: false,
    hasTelegram: false,
    hasWebsite: false,
    twitterFollowersMin: null,
    liqMin: null,
    liqMax: null,
    holdersMin: null,
    holdersMax: null,
    vol24hMin: null,
    vol24hMax: null,
    ageMinMinutes: null,
    ageMaxMinutes: null,
  };

  switch (column) {
    case 'new':
      return {
        ...common,
        mcMin: 15_000,
        mcMax: null,
        bondingMinPct: null,
        bondingMaxPct: 88,
      };
    case 'stretch':
      return {
        ...common,
        mcMin: 30_000,
        mcMax: null,
        bondingMinPct: 72,
        bondingMaxPct: 99,
      };
    case 'migrated':
      return {
        ...common,
        mcMin: 50_000,
        mcMax: null,
        bondingMinPct: 99,
        bondingMaxPct: null,
      };
    default:
      return common;
  }
}

export function recommendedColumnDisplayOptions(): ColumnDisplayOptions {
  return {
    ...DEFAULT_COLUMN_DISPLAY_OPTIONS,
    showMc: true,
    showLiq: true,
    showVol: true,
    showHolders: true,
    showDev: true,
    density: 'normal',
    showRiskFlags: true,
    showBondingRing: true,
    showLaunchpadBadge: true,
    buyButtonStyle: 'large',
    mcLayout: 'hero',
    showPumpFrame: true,
    showTraitIcons: true,
    quickBuySol: 0.5,
    secondQuickBuySol: 2,
    secondSellPct: 25,
    pulseSecondButton: 'none',
  };
}

export function recommendedPulseDisplayPrefs(chain: AppChainId): PulseDisplayPrefs {
  const protocolRowColors: Record<string, boolean> = {};
  const popular = new Set(allowedProtocols(chain));
  for (const id of supportedFilterIdsForChain(chain)) {
    protocolRowColors[id] = popular.has(id);
  }

  return withPulseDisplayDefaults({
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
      twitterFollowing: false,
      twitterFollowers: true,
      imageReuse: true,
      marketCap: true,
    },
    colorRowByProtocol: true,
    protocolRowColors,
    visibleColumns: { new: true, stretch: true, migrated: true },
    quickBuyClickBehavior: 'nothing',
    walletGroupsInHeader: true,
    secondButtonMode: 'off',
    accentHex: '#34D399',
  });
}
