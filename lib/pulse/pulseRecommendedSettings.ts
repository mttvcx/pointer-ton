import type { AppChainId } from '@/lib/chains/appChain';
import {
  DEFAULT_COLUMN_DISPLAY_OPTIONS,
  type ColumnDisplayOptions,
  type ColumnFilters,
  defaultColumnFiltersForChain,
} from '@/lib/tokens/columnPresetModel';
import { pulseProtocolPresetIdsForChain } from '@/lib/tokens/pulseProtocolRegistry';
import type { PulseDisplayPrefs } from '@/lib/preferences/pulseDisplay';
import { withPulseDisplayDefaults } from '@/lib/preferences/pulseDisplay';
import type { PulseColumnId } from '@/lib/utils/constants';

/** Popular launch venues per chain (Axiom-style starter set). */
export const RECOMMENDED_PROTOCOL_IDS: Record<AppChainId, readonly string[]> = {
  sol: [
    'pump.fun',
    'bonk',
    'moonshot',
    'bags',
    'mayhem',
    'soar',
    'jupiter-studio',
    'meteora',
    'daos.fun',
  ],
  ton: ['uranus', 'groypad', 'blum', 'tonfun'],
  eth: ['uniswap-v2', 'uniswap-v3', 'uniswap-v4', 'clanker', 'virtuals'],
  bnb: ['four.meme', 'flap', 'pancakeswap'],
  base: ['clanker', 'bankr', 'zora-creator', 'virtuals'],
};

export const PULSE_RECOMMENDED_CHECKLIST = [
  'Focus on popular launch platforms (Pump, Bonk, etc.)',
  'Filter out new tokens with a low market cap',
  'Optimized display to show essential info on Pulse',
] as const;

function allowedProtocols(chain: AppChainId): string[] {
  const allowed = new Set(pulseProtocolPresetIdsForChain(chain));
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
  for (const id of pulseProtocolPresetIdsForChain(chain)) {
    protocolRowColors[id] = popular.has(id);
  }

  return withPulseDisplayDefaults({
    activeTab: 'layout',
    mcMetricSize: 'large',
    quickBuyButtonSize: 'large',
    displayQuickBuySol: 0.5,
    compactTables: false,
    hideColumnSearch: true,
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
    accentHex: '#526EEE',
  });
}
