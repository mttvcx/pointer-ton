import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { cashbackShareBps, cashbackSharePct } from '@/lib/cashback/constants';
import { referralFeeShareBps } from '@/lib/referrals/constants';
import { DEFAULT_PLATFORM_FEE_BPS } from '@/lib/utils/constants';
import { PACK_ITEM_SELL_FEE_BPS } from '@/lib/packs/constants';

/** Mirror of `recordTradeCashbackAccrual` crediting math (floor lamports). */
function cashbackLamports(platformFee: number, shareBps: number): number {
  return Math.floor((platformFee * shareBps) / 10_000);
}

const ORIGINAL_ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('cashback share — bounds and default', () => {
  it('defaults to 5000 bps (50% of the trader’s own fee)', () => {
    delete process.env.CASHBACK_SHARE_BPS;
    delete process.env.NEXT_PUBLIC_CASHBACK_SHARE_BPS;
    assert.equal(cashbackShareBps(), 5000);
    assert.equal(cashbackSharePct(), 50);
  });

  it('respects a configured in-range override', () => {
    process.env.CASHBACK_SHARE_BPS = '4000';
    assert.equal(cashbackShareBps(), 4000);
    assert.equal(cashbackSharePct(), 40);
  });

  it('rejects out-of-range / invalid values and falls back to default', () => {
    process.env.CASHBACK_SHARE_BPS = '-5';
    assert.equal(cashbackShareBps(), 5000);
    process.env.CASHBACK_SHARE_BPS = '10001';
    assert.equal(cashbackShareBps(), 5000);
    process.env.CASHBACK_SHARE_BPS = 'not-a-number';
    assert.equal(cashbackShareBps(), 5000);
  });
});

describe('cashback accrual math', () => {
  it('credits exactly 50% of the platform fee on a normal trade', () => {
    const platformFee = 10_000_000; // 1% of 1 SOL
    assert.equal(cashbackLamports(platformFee, 5000), 5_000_000);
  });

  it('floors fractional lamports', () => {
    // 50% of 12_345 = 6172.5 -> floor 6172
    assert.equal(cashbackLamports(12_345, 5000), 6172);
    assert.equal(cashbackLamports(0, 5000), 0);
  });
});

describe('cashback + referral stack within the platform fee', () => {
  it('50% cashback + 30% referral leaves a 20% house margin', () => {
    delete process.env.CASHBACK_SHARE_BPS;
    delete process.env.NEXT_PUBLIC_CASHBACK_SHARE_BPS;
    delete process.env.REFERRAL_FEE_SHARE_BPS;
    delete process.env.NEXT_PUBLIC_REFERRAL_FEE_SHARE_BPS;
    const fee = 10_000_000;
    const cashback = cashbackLamports(fee, cashbackShareBps());
    const referral = Math.floor((fee * referralFeeShareBps()) / 10_000);
    assert.equal(cashback, 5_000_000);
    assert.equal(referral, 3_000_000);
    assert.ok(cashback + referral <= fee);
    assert.equal(fee - cashback - referral, 2_000_000); // 20% retained
  });
});

describe('pack-item sell fee', () => {
  it('is 2% — double the standard 1% trade fee', () => {
    assert.equal(PACK_ITEM_SELL_FEE_BPS, 200);
    assert.equal(PACK_ITEM_SELL_FEE_BPS, DEFAULT_PLATFORM_FEE_BPS * 2);
  });
});
