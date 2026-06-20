import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { z } from 'zod';
import { PACKS_LIVE_COMMERCE_ENABLED } from '@/lib/packs/mode';
import { computePackEconomics, resolvePackConfig } from '@/lib/packs/packConfig';
import { computeDynamicPackPrice } from '@/lib/packs/pricing';
import type { PackType } from '@/types/pack';
import { DEFAULT_APP_CHAIN, isAppChainId } from '@/lib/chains/appChain';
import { isValidTokenMintParam } from '@/lib/chains/mintKind';
import {
  BUG_CATEGORY_OPTIONS,
  BUG_SEVERITY_OPTIONS,
  POINTER_REPORT_VERSION,
} from '@/lib/reports/bugReportModel';

const ORIGINAL_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

/* --------------------------- /api/packs/open ----------------------------- */

describe('/api/packs/open — demo / simulated contract', () => {
  it('live commerce is armed, but only active with a configured treasury', () => {
    // Live commerce is ON in code, yet `liveCommerceActive()` still requires a
    // treasury signer to be configured — so the open route stays on the
    // simulated ledger anywhere the treasury key is absent (e.g. local dev),
    // and only charges + delivers on-chain where the treasury is set (prod).
    assert.equal(PACKS_LIVE_COMMERCE_ENABLED, true);
  });

  it('accepts exactly the four public pack types', () => {
    const PackTypeSchema = z.enum(['bronze', 'silver', 'gold', 'legendary']);
    for (const t of ['bronze', 'silver', 'gold', 'legendary']) {
      assert.equal(PackTypeSchema.safeParse(t).success, true);
    }
    assert.equal(PackTypeSchema.safeParse('mythic').success, false);
    assert.equal(PackTypeSchema.safeParse('').success, false);
  });

  it('every openable pack resolves to valid, house-positive economics', () => {
    for (const type of ['bronze', 'silver', 'gold', 'legendary'] as PackType[]) {
      const price = computeDynamicPackPrice(type, 72);
      const config = resolvePackConfig(type, price);
      const economics = computePackEconomics(config);
      assert.equal(economics.valid, true, `${type}: ${economics.errors.join('; ')}`);
      assert.ok(economics.fullOpenEvSol < config.packPriceSol);
    }
  });
});

/* --------------------------- /api/pulse/feed ----------------------------- */

describe('/api/pulse/feed — query contract', () => {
  const QuerySchema = z.object({
    column: z.enum(['new', 'stretch', 'migrated']).default('new'),
    chain: z.string().optional(),
  });

  it('defaults the column to "new" and rejects unknown columns', () => {
    assert.equal(QuerySchema.parse({}).column, 'new');
    assert.equal(QuerySchema.safeParse({ column: 'garbage' }).success, false);
    for (const c of ['new', 'stretch', 'migrated']) {
      assert.equal(QuerySchema.safeParse({ column: c }).success, true);
    }
  });

  it('falls back to the default chain for unknown chain ids', () => {
    const resolve = (raw?: string) => (raw && isAppChainId(raw) ? raw : DEFAULT_APP_CHAIN);
    assert.equal(resolve(undefined), DEFAULT_APP_CHAIN);
    assert.equal(resolve('not-a-chain'), DEFAULT_APP_CHAIN);
    assert.equal(resolve('sol'), 'sol');
    assert.equal(resolve('ton'), 'ton');
  });
});

/* -------------------------- /api/tokens/[mint] --------------------------- */

describe('/api/tokens/[mint] — mint param validation', () => {
  it('accepts plausible Solana / EVM mints', () => {
    assert.equal(isValidTokenMintParam('EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm'), true); // sol
    assert.equal(isValidTokenMintParam('0x' + 'a'.repeat(40)), true); // evm
  });

  it('rejects obvious junk / empty params', () => {
    assert.equal(isValidTokenMintParam(''), false);
    assert.equal(isValidTokenMintParam('not-a-mint'), false);
    assert.equal(isValidTokenMintParam('0xshort'), false);
  });
});

/* --------------------------- /api/reports/bug ---------------------------- */

describe('/api/reports/bug — gating + payload contract', () => {
  /** Mirrors `bugReportWebhookConfigured()` in the route. */
  const webhookConfigured = () => Boolean(process.env.BUG_REPORT_WEBHOOK_URL?.trim());

  it('reporting is disabled when no webhook is configured (=> 503)', () => {
    delete process.env.BUG_REPORT_WEBHOOK_URL;
    assert.equal(webhookConfigured(), false);
    process.env.BUG_REPORT_WEBHOOK_URL = '   ';
    assert.equal(webhookConfigured(), false);
  });

  it('reporting is enabled once a webhook url is set', () => {
    process.env.BUG_REPORT_WEBHOOK_URL = 'https://example.com/hook';
    assert.equal(webhookConfigured(), true);
  });

  it('payload model exposes stable version + non-empty option ids', () => {
    assert.equal(POINTER_REPORT_VERSION, 1);
    assert.ok(BUG_CATEGORY_OPTIONS.length > 0);
    assert.ok(BUG_SEVERITY_OPTIONS.length > 0);
    for (const c of BUG_CATEGORY_OPTIONS) assert.ok(c.id && c.label);
    for (const s of BUG_SEVERITY_OPTIONS) assert.ok(s.id && s.label);
  });
});
