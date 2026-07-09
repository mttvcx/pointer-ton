import type { PackConfig, PackEconomicsReport, PackOutcomeSlot } from '@/types/pack';

/** Modeled house edge floor — 22% per full pack open. */
export const MODELED_HOUSE_EDGE_MIN_BPS = 2200;

/** Max modeled payout EV as a fraction of pack price (78% of price). */
export const MAX_FULL_OPEN_EV_BPS = 7800;

/**
 * Jackpot solvency divisor. A jackpot payout may only be paid when it is at most
 * 1/20th of the internal reserve pool (rewardPoolBudgetSol at the config level, or
 * the live treasury balance at award time). Guarantees we never pay a single
 * jackpot larger than 5% of the pool, so one hit can never dent solvency.
 */
export const JACKPOT_POOL_DIVISOR = 20;

/** Largest jackpot the pool can afford under the 1/20 rule. */
export function maxAffordableJackpotSol(
  internalPoolSol: number,
  divisor: number = JACKPOT_POOL_DIVISOR,
): number {
  if (!Number.isFinite(internalPoolSol) || internalPoolSol <= 0 || divisor <= 0) return 0;
  return internalPoolSol / divisor;
}

/** True when a jackpot of `jackpotSol` is within the 1/20-of-pool solvency limit. */
export function jackpotWithinPool(
  jackpotSol: number,
  internalPoolSol: number,
  divisor: number = JACKPOT_POOL_DIVISOR,
): boolean {
  return jackpotSol <= maxAffordableJackpotSol(internalPoolSol, divisor) + 1e-9;
}

function slotEstimatedCostSol(slot: PackOutcomeSlot, packPriceSol: number): number {
  if (slot.estimatedCostSol != null && Number.isFinite(slot.estimatedCostSol)) {
    return slot.estimatedCostSol;
  }

  if (slot.kind === 'token_reward' || slot.kind === 'legendary_reward') {
    const minPct = slot.minReturnPctOfPack ?? 0;
    const maxPct = slot.maxReturnPctOfPack ?? minPct;
    const minSol = slot.minValueSol ?? packPriceSol * minPct;
    const maxSol = slot.maxValueSol ?? packPriceSol * maxPct;
    return ((minSol + maxSol) / 2) * (slot.probabilityBps / 10_000);
  }

  if (slot.kind === 'cashback_multiplier' || slot.kind === 'points_multiplier') {
    const pct = slot.estimatedCostPctOfPack ?? 0;
    if (pct > 0) return packPriceSol * pct * (slot.probabilityBps / 10_000);
    const m = slot.multiplier ?? 1;
    const implied = (m - 1) * 0.06;
    return implied * packPriceSol * (slot.probabilityBps / 10_000);
  }

  if (slot.kind === 'rare_access_badge') {
    const pct = slot.estimatedCostPctOfPack ?? 0.004;
    return packPriceSol * pct * (slot.probabilityBps / 10_000);
  }

  return 0;
}

/** Expected cost of a single card draw (one roll from the outcome table). */
export function computePerCardEvSol(config: PackConfig): number {
  return config.outcomes.reduce((s, o) => s + slotEstimatedCostSol(o, config.packPriceSol), 0);
}

function mythicJackpotEvSol(config: PackConfig): number {
  const packPriceSol = config.packPriceSol;
  return config.outcomes
    .filter((o) => o.rarity === 'mythic' && o.kind === 'legendary_reward')
    .reduce((s, o) => s + slotEstimatedCostSol(o, packPriceSol), 0);
}

export function computePackEconomics(config: PackConfig): PackEconomicsReport {
  const errors: string[] = [];
  const probSum = config.outcomes.reduce((s, o) => s + o.probabilityBps, 0);
  if (probSum !== 10_000) {
    errors.push(`Outcomes must sum to 10_000 bps (got ${probSum})`);
  }
  if (config.cardsPerOpen < 1) {
    errors.push(`cardsPerOpen must be >= 1 (got ${config.cardsPerOpen})`);
  }

  const perCardEvSol = computePerCardEvSol(config);
  const fullOpenEvSol = perCardEvSol * config.cardsPerOpen;
  const houseEdgeSol = config.packPriceSol - fullOpenEvSol;
  const houseEdgeBps =
    config.packPriceSol > 0
      ? Math.round((houseEdgeSol / config.packPriceSol) * 10_000)
      : 0;

  const maxAllowedEv = (config.packPriceSol * MAX_FULL_OPEN_EV_BPS) / 10_000;

  if (fullOpenEvSol >= config.packPriceSol) {
    errors.push(
      `Full-open EV (${fullOpenEvSol.toFixed(4)} SOL) must stay below pack price (${config.packPriceSol} SOL)`,
    );
  }
  if (fullOpenEvSol > maxAllowedEv + 1e-6) {
    errors.push(
      `Full-open EV (${fullOpenEvSol.toFixed(4)} SOL) exceeds ${MAX_FULL_OPEN_EV_BPS / 100}% of price (${maxAllowedEv.toFixed(4)} SOL)`,
    );
  }
  if (houseEdgeBps < MODELED_HOUSE_EDGE_MIN_BPS) {
    errors.push(
      `Modeled house edge ${houseEdgeBps} bps is below minimum ${MODELED_HOUSE_EDGE_MIN_BPS} bps (22%)`,
    );
  }

  if (config.maxPayoutSol > config.rewardPoolBudgetSol) {
    errors.push(
      `maxPayoutSol (${config.maxPayoutSol}) exceeds rewardPoolBudgetSol (${config.rewardPoolBudgetSol})`,
    );
  }

  // Jackpot solvency: the advertised max jackpot must be at most 1/20th of the
  // internal reserve pool, so a single top hit can never exceed 5% of the pool.
  if (!jackpotWithinPool(config.maxPayoutSol, config.rewardPoolBudgetSol)) {
    errors.push(
      `maxPayoutSol (${config.maxPayoutSol}) exceeds 1/${JACKPOT_POOL_DIVISOR} of rewardPoolBudgetSol ` +
        `(${(config.rewardPoolBudgetSol / JACKPOT_POOL_DIVISOR).toFixed(4)} SOL)`,
    );
  }

  const jackpotBudgetSol = (config.packPriceSol * config.jackpotBudgetBps) / 10_000;
  const jackpotEv = mythicJackpotEvSol(config);
  if (jackpotEv > jackpotBudgetSol + 1e-8) {
    errors.push(
      `Jackpot slot EV (${jackpotEv.toFixed(6)} SOL) exceeds jackpot budget (${jackpotBudgetSol.toFixed(6)} SOL)`,
    );
  }

  return {
    perCardEvSol,
    fullOpenEvSol,
    expectedValueSol: fullOpenEvSol,
    houseEdgeSol,
    houseEdgeBps,
    valid: errors.length === 0,
    errors,
  };
}
