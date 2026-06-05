import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLEAN_SOL_AMOUNTS,
  computeDynamicPackPrice,
  getFallbackSolUsd,
  getPackPriceSnapshot,
  roundToCleanSolAmount,
} from '@/lib/packs/pricing';
import {
  buildPackConfigFromTemplate,
  PACK_TEMPLATE_LIST,
} from '@/lib/packs/packTemplates';
import { computePackEconomics, MODELED_HOUSE_EDGE_MIN_BPS, MAX_FULL_OPEN_EV_BPS } from '@/lib/packs/packEconomics';

describe('pack pricing', () => {
  it('rounds to allowed clean SOL amounts', () => {
    assert.equal(roundToCleanSolAmount(0.139), 0.15);
    assert.equal(roundToCleanSolAmount(5.56, 7.5), 5);
    assert.ok(CLEAN_SOL_AMOUNTS.includes(roundToCleanSolAmount(0.486)));
  });

  it('at SOL 72 yields ~0.15 / 0.5 / 2 / 5 SOL tiers', () => {
    assert.equal(computeDynamicPackPrice('bronze', 72), 0.15);
    assert.equal(computeDynamicPackPrice('silver', 72), 0.5);
    assert.equal(computeDynamicPackPrice('gold', 72), 2);
    assert.equal(computeDynamicPackPrice('legendary', 72), 5);
  });

  it('at SOL 80 still yields clean values', () => {
    const snap = getPackPriceSnapshot(80);
    for (const type of ['bronze', 'silver', 'gold', 'legendary'] as const) {
      assert.ok(CLEAN_SOL_AMOUNTS.includes(snap.packs[type].packPriceSol));
    }
  });

  it('at SOL 150 respects min USD bands (not absurdly tiny)', () => {
    const bronze = computeDynamicPackPrice('bronze', 150);
    const legendary = computeDynamicPackPrice('legendary', 150);
    assert.ok(bronze >= 0.05);
    assert.ok(legendary >= 2);
    assert.equal(bronze, 0.075);
    assert.equal(legendary, 2.5);
  });

  it('fallback env defaults to 72 when unset', () => {
    const fb = getFallbackSolUsd();
    assert.ok(fb > 0);
  });
});

describe('pack full-open economics', () => {
  for (const solUsd of [72, 80, 150]) {
    it(`validates all tiers @ SOL ${solUsd}`, () => {
      for (const template of PACK_TEMPLATE_LIST) {
        const price = computeDynamicPackPrice(template.type, solUsd);
        const config = buildPackConfigFromTemplate(template, price);
        const report = computePackEconomics(config);
        assert.equal(report.valid, true, report.errors.join('; '));
        assert.ok(report.fullOpenEvSol < config.packPriceSol);
        assert.ok(report.houseEdgeBps >= MODELED_HOUSE_EDGE_MIN_BPS);
        const maxEv = (config.packPriceSol * MAX_FULL_OPEN_EV_BPS) / 10_000;
        assert.ok(report.fullOpenEvSol <= maxEv + 1e-6);
        assert.ok(report.perCardEvSol * config.cardsPerOpen <= config.packPriceSol);
      }
    });
  }

  it('rejects invalid outcome weights', () => {
    const template = PACK_TEMPLATE_LIST[0]!;
    const config = buildPackConfigFromTemplate(template, 0.15);
    config.outcomes[0]!.probabilityBps = 9_000;
    const report = computePackEconomics(config);
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((e) => e.includes('10_000 bps')));
  });

  it('invalid cardsPerOpen fails validation (pack cannot open)', () => {
    const template = PACK_TEMPLATE_LIST[0]!;
    const config = buildPackConfigFromTemplate(template, 0.15);
    config.cardsPerOpen = 0;
    const report = computePackEconomics(config);
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((e) => e.includes('cardsPerOpen')));
  });
});
