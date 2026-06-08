import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Static boundary guard: sandbox modules must never import live trading,
 * payout, signing, or data-infra paths, and must never reference the live
 * trade/pack API routes. This is the structural proof that sandbox execution
 * cannot reach live quote/execute.
 */

const ROOT = process.cwd();

const SANDBOX_FILES = [
  'lib/sandbox/mode.ts',
  'lib/sandbox/types.ts',
  'lib/sandbox/executor.ts',
  'lib/sandbox/market.ts',
  'lib/sandbox/ledger.ts',
  'lib/sandbox/trade.ts',
  'lib/sandbox/packs.ts',
  'lib/hooks/useSandboxWallet.ts',
  'lib/hooks/useSandboxTrades.ts',
];

// Substrings that must NOT appear anywhere in sandbox source.
const BANNED = [
  '/api/trade/quote',
  '/api/trade/execute',
  '/api/packs/open',
  '@/lib/db/trades',
  '@/lib/db/packs',
  '@/lib/points',
  '@/lib/referrals',
  '@/lib/solana/submit',
  '@/lib/privy/serverWalletSign',
  '@/lib/jupiter',
  'usePointerTradeSubmit',
  'signAndSendTransaction',
];

describe('sandbox isolation boundary', () => {
  for (const rel of SANDBOX_FILES) {
    it(`${rel} imports no live trading / payout / signing paths`, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      for (const banned of BANNED) {
        assert.ok(
          !src.includes(banned),
          `${rel} must not reference "${banned}" (sandbox must stay isolated from live execution)`,
        );
      }
    });
  }

  it('sandbox files never call fetch directly', () => {
    for (const rel of SANDBOX_FILES) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      assert.ok(!/\bfetch\s*\(/.test(src), `${rel} must not call fetch (sandbox is offline)`);
    }
  });
});
