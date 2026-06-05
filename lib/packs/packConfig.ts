import { formatProbabilityBps } from '@/lib/packs/formatOdds';
import { computePackEconomics } from '@/lib/packs/packEconomics';
import {
  buildPackConfigFromTemplate,
  PACK_TEMPLATE_LIST,
  PACK_TEMPLATES,
} from '@/lib/packs/packTemplates';
import {
  computeDynamicPackPrice,
  getFallbackSolUsd,
  getPackPriceSnapshot,
  getSolUsdPrice,
  type PackPriceSnapshot,
  type SolUsdQuote,
} from '@/lib/packs/pricing';
import type {
  PackConfig,
  PackEconomicsReport,
  PackOddsRow,
  PackOutcomeSlot,
  PackPublicConfig,
  PackType,
  RewardKind,
  RewardRarity,
} from '@/types/pack';

export { computePackEconomics } from '@/lib/packs/packEconomics';
export {
  computeDynamicPackPrice,
  getFallbackSolUsd,
  getPackPriceSnapshot,
  getSolUsdPrice,
  roundToCleanSolAmount,
  CLEAN_SOL_AMOUNTS,
  PACK_USD_BANDS,
} from '@/lib/packs/pricing';

const RARITY_ORDER: RewardRarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
];

function buildOddsRows(outcomes: PackOutcomeSlot[]): PackOddsRow[] {
  const byRarity = new Map<RewardRarity, { bps: number; kinds: Set<RewardKind> }>();
  for (const o of outcomes) {
    const cur = byRarity.get(o.rarity) ?? { bps: 0, kinds: new Set<RewardKind>() };
    cur.bps += o.probabilityBps;
    cur.kinds.add(o.kind);
    byRarity.set(o.rarity, cur);
  }
  return RARITY_ORDER.filter((r) => byRarity.has(r)).map((rarity) => {
    const row = byRarity.get(rarity)!;
    return {
      rarity,
      probabilityBps: row.bps,
      probabilityPct: formatProbabilityBps(row.bps),
      kinds: [...row.kinds],
    };
  });
}

/** Resolve pack config at a dynamic SOL price (validates full-open economics). */
export function resolvePackConfig(type: PackType, packPriceSol: number): PackConfig {
  const template = PACK_TEMPLATES[type];
  if (!template) throw new Error(`Unknown pack type: ${type}`);
  const config = buildPackConfigFromTemplate(template, packPriceSol);
  const report = computePackEconomics(config);
  if (!report.valid) {
    throw new Error(`Invalid pack config "${type}" @ ${packPriceSol} SOL: ${report.errors.join('; ')}`);
  }
  return config;
}

export async function resolvePackConfigAtMarket(type: PackType): Promise<{
  config: PackConfig;
  quote: SolUsdQuote;
  snapshot: PackPriceSnapshot;
}> {
  const quote = await getSolUsdPrice();
  const snapshot = getPackPriceSnapshot(quote.solUsd);
  snapshot.source = quote.source;
  const packPriceSol = snapshot.packs[type].packPriceSol;
  const config = resolvePackConfig(type, packPriceSol);
  return { config, quote, snapshot };
}

/** @deprecated Use resolvePackConfigAtMarket — static fallback for legacy call sites. */
export function getPackConfig(type: PackType, solUsd?: number): PackConfig {
  const rate = solUsd != null && solUsd > 0 ? solUsd : getFallbackSolUsd();
  const price = computeDynamicPackPrice(type, rate);
  return resolvePackConfig(type, price);
}

export function getEnabledPackTypes(): PackType[] {
  return PACK_TEMPLATE_LIST.filter((t) => true).map((t) => t.type);
}

export function toPublicPackConfig(
  config: PackConfig,
  meta?: { solUsd?: number; solUsdSource?: 'live' | 'fallback'; approximateUsd?: number },
): PackPublicConfig {
  const kinds = [...new Set(config.outcomes.map((o) => o.kind))];
  return {
    type: config.type,
    label: config.label,
    tagline: config.tagline,
    packPriceSol: config.packPriceSol,
    minReturnSol: config.minReturnSol,
    maxNormalReturnSol: config.maxNormalReturnSol,
    rareChanceBps: config.rareChanceBps,
    legendaryChanceBps: config.legendaryChanceBps,
    jackpotChanceBps: config.jackpotChanceBps,
    maxPayoutSol: config.maxPayoutSol,
    enabled: config.enabled,
    cardsPerOpen: config.cardsPerOpen,
    odds: buildOddsRows(config.outcomes),
    rewardKinds: kinds,
    economics: computePackEconomics(config),
    approximateUsd: meta?.approximateUsd,
    solUsd: meta?.solUsd,
    solUsdSource: meta?.solUsdSource,
  };
}

export async function listPublicPackConfigs(): Promise<{
  packs: PackPublicConfig[];
  snapshot: PackPriceSnapshot;
  quote: SolUsdQuote;
}> {
  const quote = await getSolUsdPrice();
  const snapshot = getPackPriceSnapshot(quote.solUsd);
  snapshot.source = quote.source;

  const packs = PACK_TEMPLATE_LIST.map((template) => {
    const entry = snapshot.packs[template.type];
    const config = resolvePackConfig(template.type, entry.packPriceSol);
    return toPublicPackConfig(config, {
      solUsd: quote.solUsd,
      solUsdSource: quote.source,
      approximateUsd: entry.approximateUsd,
    });
  });

  return { packs, snapshot, quote };
}

/** Synchronous list using fallback SOL price (client-safe default). */
export function listPublicPackConfigsSync(solUsd?: number): PackPublicConfig[] {
  const rate = solUsd != null && solUsd > 0 ? solUsd : getFallbackSolUsd();
  const snapshot = getPackPriceSnapshot(rate);
  return PACK_TEMPLATE_LIST.map((template) => {
    const entry = snapshot.packs[template.type];
    const config = resolvePackConfig(template.type, entry.packPriceSol);
    return toPublicPackConfig(config, {
      solUsd: rate,
      solUsdSource: 'fallback',
      approximateUsd: entry.approximateUsd,
    });
  });
}

export function economicsForPackType(type: PackType, solUsd?: number): PackEconomicsReport {
  return computePackEconomics(getPackConfig(type, solUsd));
}
