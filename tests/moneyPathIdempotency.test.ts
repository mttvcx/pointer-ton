import '@/lib/testing/stubServerOnly'; // MUST be first — lets server modules import
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { FakeSupabase, type Row } from '@/lib/testing/fakeSupabase';
import { __resetAdminSupabaseForTest, __setAdminSupabaseForTest } from '@/lib/supabase/server';
import { recordTradeCashbackAccrual } from '@/lib/cashback/accrual';
import { recordReferralEarningFromTrade } from '@/lib/referrals/earnings';
import { awardPoints } from '@/lib/points/award';

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

const dedupeKey = (r: Row) => {
  const dk = (r.metadata as Record<string, unknown> | undefined)?.dedupe_key;
  return dk != null ? `${r.user_id}|${r.event_type}|${dk}` : null;
};

describe('money idempotency — points awards', () => {
  afterEach(() => __resetAdminSupabaseForTest());

  it('the same daily-login dedupe key awards EXACTLY ONCE', async () => {
    const db = new FakeSupabase().addUnique('points_events', dedupeKey);
    __setAdminSupabaseForTest(db);
    const a = await awardPoints('u', 'daily_login', { dedupeKey: 'login:2026-01-01' });
    const b = await awardPoints('u', 'daily_login', { dedupeKey: 'login:2026-01-01' });
    assert.equal(a.skipped, false);
    assert.equal(b.skipped, true);
    assert.equal(b.reason, 'duplicate');
    assert.equal(db.rowCount('points_events'), 1);
  });
});

describe('money paths — failure injection', () => {
  afterEach(() => __resetAdminSupabaseForTest());

  it('a unique-violation when the pre-check MISSED is treated as idempotent (no throw, no dup)', async () => {
    // Simulate the race: pre-check finds nothing, but the insert loses to a
    // concurrent writer → 23505. The module must no-op, not throw or double-credit.
    const db = new FakeSupabase().addUnique('cashback_ledger', tradeId);
    db.failNextInsert('cashback_ledger', { code: '23505', message: 'duplicate key value violates unique constraint' });
    __setAdminSupabaseForTest(db);
    await recordTradeCashbackAccrual({ userId: 'u', tradeId: 't1', platformFeeLamports: 1_000_000 });
    assert.equal(db.rowCount('cashback_ledger'), 0); // the injected dup blocked the write, no throw
  });

  it('a NON-unique DB error is NOT swallowed (surfaces, never silently lost)', async () => {
    const db = new FakeSupabase().addUnique('cashback_ledger', tradeId);
    db.failNextInsert('cashback_ledger', { code: '08006', message: 'connection failure' });
    __setAdminSupabaseForTest(db);
    await assert.rejects(
      () => recordTradeCashbackAccrual({ userId: 'u', tradeId: 't1', platformFeeLamports: 1_000_000 }),
      /recordTradeCashbackAccrual/,
    );
  });
});
