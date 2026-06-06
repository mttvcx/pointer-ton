import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computePackEconomics,
  computePerCardEvSol,
  MAX_FULL_OPEN_EV_BPS,
  MODELED_HOUSE_EDGE_MIN_BPS,
} from '@/lib/packs/packEconomics';
import {
  buildPackConfigFromTemplate,
  PACK_TEMPLATE_LIST,
} from '@/lib/packs/packTemplates';
import { computeDynamicPackPrice } from '@/lib/packs/pricing';

const SOL_USD_SCENARIOS = [60, 72, 80, 120, 150, 220] as const;

describe('pack economics — house edge / EV invariants', () => {
  it('house edge floor and EV ceiling are internally consistent', () => {
    // The configured payout ceiling plus the minimum house edge must not exceed 100%.
    assert.ok(MODELED_HOUSE_EDGE_MIN_BPS + MAX_FULL_OPEN_EV_BPS <= 10_000);
    assert.equal(MODELED_HOUSE_EDGE_MIN_BPS, 2200); // 22%
    assert.equal(MAX_FULL_OPEN_EV_BPS, 7800); // 78%
  });

  for (const solUsd of SOL_USD_SCENARIOS) {
    it(`every tier stays house-positive @ SOL $${solUsd}`, () => {
      for (const template of PACK_TEMPLATE_LIST) {
        const price = computeDynamicPackPrice(template.type, solUsd);
        const config = buildPackConfigFromTemplate(template, price);
        const report = computePackEconomics(config);

        assert.equal(report.valid, true, `${template.type}: ${report.errors.join('; ')}`);

        // Target 1: full-open EV must stay strictly below pack price (house always wins long-run).
        assert.ok(
          report.fullOpenEvSol < config.packPriceSol,
          `${template.type} EV ${report.fullOpenEvSol} !< price ${config.packPriceSol}`,
        );

        // Target 2: EV must not exceed the configured 78% payout ceiling.
        const maxEv = (config.packPriceSol * MAX_FULL_OPEN_EV_BPS) / 10_000;
        assert.ok(
          report.fullOpenEvSol <= maxEv + 1e-9,
          `${template.type} EV ${report.fullOpenEvSol} > ceiling ${maxEv}`,
        );

        // Target 3: modeled house edge must clear the configured minimum.
        assert.ok(
          report.houseEdgeBps >= MODELED_HOUSE_EDGE_MIN_BPS,
          `${template.type} edge ${report.houseEdgeBps}bps < ${MODELED_HOUSE_EDGE_MIN_BPS}bps`,
        );

        // house edge in SOL equals price minus EV, and is positive.
        assert.ok(Math.abs(report.houseEdgeSol - (config.packPriceSol - report.fullOpenEvSol)) < 1e-9);
        assert.ok(report.houseEdgeSol > 0);

        // full-open EV is per-card EV times cards drawn.
        const perCard = computePerCardEvSol(config);
        assert.ok(Math.abs(report.fullOpenEvSol - perCard * config.cardsPerOpen) < 1e-9);
      }
    });
  }
});

describe('pack economics — validation guards', () => {
  it('flags outcome weights that do not sum to 10_000 bps', () => {
    const template = PACK_TEMPLATE_LIST[0]!;
    const config = buildPackConfigFromTemplate(template, computeDynamicPackPrice(template.type, 72));
    config.outcomes[0]!.probabilityBps += 500;
    const report = computePackEconomics(config);
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((e) => e.includes('10_000 bps')));
  });

  it('flags a pack that cannot be opened (cardsPerOpen < 1)', () => {
    const template = PACK_TEMPLATE_LIST[0]!;
    const config = buildPackConfigFromTemplate(template, computeDynamicPackPrice(template.type, 72));
    config.cardsPerOpen = 0;
    const report = computePackEconomics(config);
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((e) => e.includes('cardsPerOpen')));
  });

  it('flags an EV that exceeds the pack price (negative house edge)', () => {
    const template = PACK_TEMPLATE_LIST[0]!;
    const config = buildPackConfigFromTemplate(template, computeDynamicPackPrice(template.type, 72));
    // Force a payout slot to be worth far more than the pack.
    const slot = config.outcomes.find((o) => o.kind === 'token_reward' || o.kind === 'legendary_reward');
    if (slot) {
      slot.estimatedCostSol = config.packPriceSol * 2;
      const report = computePackEconomics(config);
      assert.equal(report.valid, false);
      assert.ok(report.errors.length > 0);
    }
  });
});
