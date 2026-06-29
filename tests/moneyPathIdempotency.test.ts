import '@/lib/testing/stubServerOnly'; // MUST be first — lets server modules import
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { FakeSupabase, type Row } from '@/lib/testing/fakeSupabase';
import { __resetAdminSupabaseForTest, __setAdminSupabaseForTest } from '@/lib/supabase/server';
import { recordTradeCashbackAccrual } from '@/lib/cashback/accrual';
import { recordReferralEarningFromTrade } from '@/lib/referrals/earnings';

const tradeId = (r: Row) => {
  if (r.kind !== 'accrual') return null;
  const tid = (r.metadata as Record<string, unknown> | undefined)?.trade_id;
  return tid != null ? String(tid) : null;
};

describe('money idempotency — cashback accrual', () => {
  afterEach(() => __resetAdminSupabaseForTest());

  it('double-submit for the same trade accrues EXACTLY ONCE', async () => {
    const db = new FakeSupabase().addUnique('cashback_ledger', tradeId);
    __setAdminSupabaseForTest(db);
    await recordTradeCashbackAccrual({ userId: 'u', tradeId: 't1', platformFeeLamports: 1_000_000 });
    await recordTradeCashbackAccrual({ userId: 'u', tradeId: 't1', platformFeeLamports: 1_000_000 });
    assert.equal(db.rowCount('cashback_ledger'), 1);
  });

  it('distinct trades each accrue', async () => {
    const db = new FakeSupabase().addUnique('cashback_ledger', tradeId);
    __setAdminSupabaseForTest(db);
    await recordTradeCashbackAccrual({ userId: 'u', tradeId: 't1', platformFeeLamports: 1_000_000 });
    await recordTradeCashbackAccrual({ userId: 'u', tradeId: 't2', platformFeeLamports: 1_000_000 });
    assert.equal(db.rowCount('cashback_ledger'), 2);
  });

  it('a zero fee accrues nothing', async () => {
    const db = new FakeSupabase().addUnique('cashback_ledger', tradeId);
    __setAdminSupabaseForTest(db);
    await recordTradeCashbackAccrual({ userId: 'u', tradeId: 't1', platformFeeLamports: 0 });
    assert.equal(db.rowCount('cashback_ledger'), 0);
  });
});

describe('money idempotency — referral earnings', () => {
  afterEach(() => __resetAdminSupabaseForTest());

  it('double-submit credits the referrer EXACTLY ONCE', async () => {
    const db = new FakeSupabase().addUnique('referral_earnings', (r) =>
      r.trade_id != null ? String(r.trade_id) : null,
    );
    // A referral relationship must exist (referrer != referred).
    db.seed('referrals', [{ referrer_id: 'ref', referred_id: 'u', code: 'CODE' }]);
    __setAdminSupabaseForTest(db);
    await recordReferralEarningFromTrade({ referredUserId: 'u', tradeId: 't1', platformFeeLamports: 1_000_000 });
    await recordReferralEarningFromTrade({ referredUserId: 'u', tradeId: 't1', platformFeeLamports: 1_000_000 });
    assert.equal(db.rowCount('referral_earnings'), 1);
  });

  it('no earning when there is no referral relationship', async () => {
    const db = new FakeSupabase().addUnique('referral_earnings', (r) =>
      r.trade_id != null ? String(r.trade_id) : null,
    );
    __setAdminSupabaseForTest(db);
    await recordReferralEarningFromTrade({ referredUserId: 'u', tradeId: 't1', platformFeeLamports: 1_000_000 });
    assert.equal(db.rowCount('referral_earnings'), 0);
  });
});
