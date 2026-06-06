import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  isUiDemoMode,
  preferTokenTableDemoRows,
  uiDemoModeFromEnv,
} from '@/lib/dev/uiDemoMode';
import {
  demoFixturesEnabledClient,
  demoFixturesEnabledServer,
  demoTablesEnabled,
  EMPTY_TOKEN_EXTENDED_METRICS,
} from '@/lib/dev/demoPolicy';
import { championshipDemoDataEnabled } from '@/lib/championship/mode';

/**
 * Guards the single most important pre-beta invariant:
 *   In a clean (live) environment with no demo flags set, NONE of the demo
 *   gates may report true. Components consult these gates before rendering any
 *   synthetic token rows / traders / holders / wallet intel / pack ledgers.
 *
 * `window` is undefined under node, so the localStorage override path is also
 * exercised as "off" here.
 */

const DEMO_ENV_KEYS = [
  'NEXT_PUBLIC_UI_DEMO_MODE',
  'NEXT_PUBLIC_POINTER_TABLE_DEMO',
  'NEXT_PUBLIC_CHAMPIONSHIP_DEMO',
];

const ORIGINAL_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function clearDemoEnv() {
  for (const k of DEMO_ENV_KEYS) delete process.env[k];
}

describe('live safety — demo gates default OFF', () => {
  it('no env flags => every demo gate is false (live mode)', () => {
    clearDemoEnv();
    assert.equal(uiDemoModeFromEnv(), false, 'uiDemoModeFromEnv');
    assert.equal(isUiDemoMode(), false, 'isUiDemoMode');
    assert.equal(preferTokenTableDemoRows(), false, 'preferTokenTableDemoRows');
    assert.equal(demoFixturesEnabledServer(), false, 'demoFixturesEnabledServer');
    assert.equal(demoFixturesEnabledClient(false), false, 'demoFixturesEnabledClient');
    assert.equal(demoTablesEnabled(false), false, 'demoTablesEnabled');
    assert.equal(championshipDemoDataEnabled(), false, 'championshipDemoDataEnabled');
  });

  it('explicit "0"/"false" never enables demo data', () => {
    clearDemoEnv();
    process.env.NEXT_PUBLIC_UI_DEMO_MODE = '0';
    process.env.NEXT_PUBLIC_POINTER_TABLE_DEMO = 'false';
    process.env.NEXT_PUBLIC_CHAMPIONSHIP_DEMO = '0';
    assert.equal(uiDemoModeFromEnv(), false);
    assert.equal(preferTokenTableDemoRows(), false);
    assert.equal(demoFixturesEnabledServer(), false);
    assert.equal(championshipDemoDataEnabled(), false);
  });
});

describe('demo safety — explicit opt-in still works', () => {
  it('only an explicit "1"/"true" flag flips the gate on', () => {
    clearDemoEnv();
    process.env.NEXT_PUBLIC_UI_DEMO_MODE = '1';
    assert.equal(uiDemoModeFromEnv(), true);
    assert.equal(demoFixturesEnabledServer(), true);
    // components pass the computed uiDemo flag into demoTablesEnabled(uiDemo)
    assert.equal(demoTablesEnabled(true), true); // uiDemo path
    assert.equal(demoFixturesEnabledClient(true), true);
    assert.equal(championshipDemoDataEnabled(), true); // falls through to ui demo

    clearDemoEnv();
    process.env.NEXT_PUBLIC_POINTER_TABLE_DEMO = '1';
    assert.equal(preferTokenTableDemoRows(), true);
    assert.equal(demoTablesEnabled(false), true); // table-demo path
    // table-demo must NOT turn on the full client fixture deck
    assert.equal(demoFixturesEnabledClient(false), false);
    // ...and must NOT enable server fixtures (those are UI_DEMO only)
    assert.equal(demoFixturesEnabledServer(), false);
  });

  it('championship demo can be force-disabled even under global UI demo', () => {
    clearDemoEnv();
    process.env.NEXT_PUBLIC_UI_DEMO_MODE = '1';
    process.env.NEXT_PUBLIC_CHAMPIONSHIP_DEMO = '0';
    assert.equal(championshipDemoDataEnabled(), false);
  });
});

describe('live safety — empty metrics never fabricate numbers', () => {
  it('EMPTY_TOKEN_EXTENDED_METRICS is all-null (no invented holder/security data)', () => {
    for (const [key, value] of Object.entries(EMPTY_TOKEN_EXTENDED_METRICS)) {
      assert.equal(value, null, `${key} must be null in live empty state`);
    }
  });
});
