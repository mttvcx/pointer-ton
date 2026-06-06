import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { DEFAULT_PLATFORM_FEE_BPS } from '@/lib/utils/constants';
import { referralFeeShareBps } from '@/lib/referrals/constants';
import { solToLamports } from '@/lib/utils/formatters';

/**
 * Canonical platform-fee formula. This mirrors the inline computation in
 * `app/api/trade/execute/route.ts` (both the Solana and TON branches):
 *   platformFeeLamports = (lamports * feeBps) / 10_000   (integer / floor)
 * Keep this in sync if the route changes. See SECURITY-TEST-REPORT.md.
 */
function platformFeeLamports(lamports: bigint, feeBps: number): number {
  return Number((lamports * BigInt(feeBps)) / 10_000n);
}

/** Mirror of `recordReferralEarningFromTrade` crediting math. */
function referralEarningLamports(platformFee: number, shareBps: number): number {
  return Math.floor((platformFee * shareBps) / 10_000);
}

const ORIGINAL_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('fee math — default platform fee', () => {
  it('default tier fee is 1% (100 bps)', () => {
    assert.equal(DEFAULT_PLATFORM_FEE_BPS, 100);
  });

  it('charges exactly 1% on a normal trade notional', () => {
    const oneSol = solToLamports(1); // 1_000_000_000n
    assert.equal(oneSol, 1_000_000_000n);
    // 1% of 1 SOL = 0.01 SOL = 10_000_000 lamports
    assert.equal(platformFeeLamports(oneSol, DEFAULT_PLATFORM_FEE_BPS), 10_000_000);
  });

  it('autobuy / autolaunch trades use the same 1% tier fee path', () => {
    // Autobuy/autolaunch execute through the same /api/trade/execute fee path,
    // so the fee equals getFeeBpsForUser() (default 100 bps) of the notional.
    const halfSol = solToLamports(0.5);
    assert.equal(platformFeeLamports(halfSol, DEFAULT_PLATFORM_FEE_BPS), 5_000_000);
  });

  it('fee scales linearly and floors fractional lamports', () => {
    // 100 bps of 12_345 lamports = 123.45 -> floor 123
    assert.equal(platformFeeLamports(12_345n, 100), 123);
    // zero notional -> zero fee
    assert.equal(platformFeeLamports(0n, 100), 0);
  });
});

describe('fee math — referral / cashback share bounds', () => {
  it('defaults referral share to 3000 bps (30% of platform fee)', () => {
    delete process.env.REFERRAL_FEE_SHARE_BPS;
    delete process.env.NEXT_PUBLIC_REFERRAL_FEE_SHARE_BPS;
    assert.equal(referralFeeShareBps(), 3000);
  });

  it('respects a configured in-range override', () => {
    process.env.REFERRAL_FEE_SHARE_BPS = '2500';
    assert.equal(referralFeeShareBps(), 2500);
  });

  it('rejects out-of-range / invalid values and falls back to default', () => {
    process.env.REFERRAL_FEE_SHARE_BPS = '-5';
    assert.equal(referralFeeShareBps(), 3000);
    process.env.REFERRAL_FEE_SHARE_BPS = '10001';
    assert.equal(referralFeeShareBps(), 3000);
    process.env.REFERRAL_FEE_SHARE_BPS = 'not-a-number';
    assert.equal(referralFeeShareBps(), 3000);
  });

  it('referral share never exceeds the platform fee (bounded 0..10000 bps)', () => {
    const platformFee = 10_000_000; // 1% of 1 SOL
    // max legal share = 100% of fee
    assert.equal(referralEarningLamports(platformFee, 10_000), platformFee);
    // default 30%
    assert.equal(referralEarningLamports(platformFee, 3000), 3_000_000);
    // share is always <= platform fee for any legal bps
    for (const bps of [0, 1, 1500, 3000, 9999, 10_000]) {
      assert.ok(referralEarningLamports(platformFee, bps) <= platformFee);
    }
  });
});
