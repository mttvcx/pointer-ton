import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fixedWindowBucket,
  isOverFixedWindow,
  pickCeilingBreach,
  type SpendCaps,
} from '@/lib/ai/quotaDecisions';

const CAPS: SpendCaps = { userDaily: 0.3, globalHourly: 25, globalDaily: 200, globalMonthly: 3000 };

describe('quota: pickCeilingBreach', () => {
  it('returns null when under every ceiling', () => {
    assert.equal(pickCeilingBreach({ userDaily: 0.1, globalHourly: 1, globalDaily: 5, globalMonthly: 50 }, CAPS), null);
  });
  it('flags the per-user daily ceiling', () => {
    assert.equal(
      pickCeilingBreach({ userDaily: 0.31, globalHourly: 1, globalDaily: 5, globalMonthly: 50 }, CAPS),
      'user_daily',
    );
  });
  it('flags global hourly / daily / monthly', () => {
    assert.equal(pickCeilingBreach({ userDaily: 0, globalHourly: 25.01, globalDaily: 5, globalMonthly: 50 }, CAPS), 'global_hourly');
    assert.equal(pickCeilingBreach({ userDaily: 0, globalHourly: 1, globalDaily: 200.01, globalMonthly: 50 }, CAPS), 'global_daily');
    assert.equal(pickCeilingBreach({ userDaily: 0, globalHourly: 1, globalDaily: 5, globalMonthly: 3000.01 }, CAPS), 'global_monthly');
  });
  it('global ceilings take precedence over the per-user one', () => {
    // both user-daily and global-hourly are over — global wins.
    assert.equal(
      pickCeilingBreach({ userDaily: 5, globalHourly: 25.01, globalDaily: 5, globalMonthly: 50 }, CAPS),
      'global_hourly',
    );
  });
  it('exactly at the cap is allowed (strict >)', () => {
    assert.equal(pickCeilingBreach({ userDaily: 0.3, globalHourly: 25, globalDaily: 200, globalMonthly: 3000 }, CAPS), null);
  });
});

describe('quota: fixed-window rate limit', () => {
  it('over only when the post-increment count exceeds max', () => {
    assert.equal(isOverFixedWindow(50, 50), false); // 50th call allowed
    assert.equal(isOverFixedWindow(51, 50), true); // 51st rejected
    assert.equal(isOverFixedWindow(1, 50), false);
  });
  it('bucket advances by window', () => {
    const w = 60;
    const b0 = fixedWindowBucket(0, w);
    const bSame = fixedWindowBucket(59_999, w);
    const bNext = fixedWindowBucket(60_000, w);
    assert.equal(b0, bSame);
    assert.equal(bNext, b0 + 1);
  });
});
