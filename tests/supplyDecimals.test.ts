import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeTokenSupplyUi,
  resolveTokenSupplyUi,
} from '../lib/tokens/supplyUi';
import { extractSupplyTokens } from '../lib/tokens/metadataHints';

describe('supplyUi WIF pump mint', () => {
  const WIF_RAW = 999_996_090_000_000;
  const WIF_DECIMALS = 6;

  it('normalizes Token-2022 base units to ~1B UI supply', () => {
    const ui = normalizeTokenSupplyUi(WIF_RAW, WIF_DECIMALS);
    assert.ok(ui > 999_000_000 && ui < 1_001_000_000, `got ${ui}`);
  });

  it('extractSupplyTokens applies decimals', () => {
    const ui = extractSupplyTokens({ supply: WIF_RAW }, WIF_DECIMALS);
    assert.ok(ui != null && ui > 999_000_000 && ui < 1_001_000_000);
  });

  it('resolveTokenSupplyUi falls back to MC/price', () => {
    const ui = resolveTokenSupplyUi(null, 6, {
      marketCapUsd: 17_600,
      priceUsd: 0.0000176,
    });
    assert.ok(ui != null && ui > 900_000_000);
  });

  it('trade MC uses sane supply not raw base units', () => {
    const supply = resolveTokenSupplyUi({ supply: WIF_RAW }, WIF_DECIMALS);
    const price = 0.000018;
    const mc = (supply ?? 0) * price;
    assert.ok(mc > 15_000 && mc < 25_000, `mc=${mc}`);
  });
});
