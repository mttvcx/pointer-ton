import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  isUiDemoMode,
  preferTokenTableDemoRows,
  uiDemoModeFromEnv,
} from '@/lib/dev/uiDemoMode';
import { isSandboxMode } from '@/lib/sandbox/mode';
import { pickTokenTradePerfChanges } from '@/lib/tokens/tokenTradePerfTfs';

/**
 * Founder beta hard-lock invariants:
 *   1. NEXT_PUBLIC_FOUNDER_BETA=1 force-disables every demo gate and sandbox
 *      execution regardless of other env flags.
 *   2. Token desk TF % never synthesizes by default — missing Dex windows
 *      must surface as null (rendered `—`), never a fabricated number.
 */

const ENV_KEYS = [
  'NEXT_PUBLIC_FOUNDER_BETA',
  'NEXT_PUBLIC_UI_DEMO_MODE',
  'NEXT_PUBLIC_POINTER_TABLE_DEMO',
  'NEXT_PUBLIC_POINTER_SANDBOX_MODE',
];

const ORIGINAL_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

describe('founder beta — demo/sandbox hard lock', () => {
  it('founder beta disables UI demo even when demo env flags are set', () => {
    clearEnv();
    process.env.NEXT_PUBLIC_FOUNDER_BETA = '1';
    process.env.NEXT_PUBLIC_UI_DEMO_MODE = '1';
    process.env.NEXT_PUBLIC_POINTER_TABLE_DEMO = '1';
    assert.equal(uiDemoModeFromEnv(), false, 'uiDemoModeFromEnv locked');
    assert.equal(isUiDemoMode(), false, 'isUiDemoMode locked');
    assert.equal(preferTokenTableDemoRows(), false, 'table demo locked');
  });

  it('founder beta disables sandbox execution even when sandbox env flag is set', () => {
    clearEnv();
    process.env.NEXT_PUBLIC_FOUNDER_BETA = '1';
    process.env.NEXT_PUBLIC_POINTER_SANDBOX_MODE = '1';
    assert.equal(isSandboxMode(), false, 'sandbox locked under founder beta');
  });

  it('without founder beta, explicit opt-in flags still work (dev workflow)', () => {
    clearEnv();
    process.env.NEXT_PUBLIC_UI_DEMO_MODE = '1';
    assert.equal(uiDemoModeFromEnv(), true);
    process.env.NEXT_PUBLIC_POINTER_SANDBOX_MODE = '1';
    assert.equal(isSandboxMode(), true);
  });
});

describe('token desk TF % — no synthetic values by default', () => {
  const MINT = 'CExejcGZSEnk4FBsBQa3nMnU1jjCYsjw4x9d7cJ4pump';

  it('missing extended_metrics => all TF % are null', () => {
    const out = pickTokenTradePerfChanges(null, MINT);
    assert.equal(out['5m'], null);
    assert.equal(out['1h'], null);
    assert.equal(out['6h'], null);
    assert.equal(out['24h'], null);
  });

  it('empty object => all TF % are null (no hash fabrication)', () => {
    const out = pickTokenTradePerfChanges({}, MINT);
    for (const tf of ['5m', '1h', '6h', '24h'] as const) {
      assert.equal(out[tf], null, `${tf} must be null without Dex data`);
    }
  });

  it('real Dex fields pass through untouched', () => {
    const out = pickTokenTradePerfChanges(
      { priceChange: { m5: 1.2, h1: -3.4, h6: 7.8, h24: -12.5 } },
      MINT,
    );
    assert.equal(out['5m'], 1.2);
    assert.equal(out['1h'], -3.4);
    assert.equal(out['6h'], 7.8);
    assert.equal(out['24h'], -12.5);
  });

  it('synthetic is opt-in only (demo fixtures must pass allowSynthetic: true)', () => {
    const live = pickTokenTradePerfChanges({}, MINT);
    const demo = pickTokenTradePerfChanges({}, MINT, { allowSynthetic: true });
    assert.equal(live['1h'], null);
    assert.notEqual(demo['1h'], null);
  });
});
