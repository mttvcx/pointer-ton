import '@/lib/testing/stubServerOnly'; // MUST be first — lets server-only modules import
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  __setEmergencyRedisForTest,
  getControls,
  assertTradingAllowed,
  assertPacksAllowed,
  assertWriteAllowed,
  assertAiAllowed,
  isReadOnly,
  EmergencyBlockedError,
} from '@/lib/emergency/controls';
import type { RedisLike } from '@/lib/redis/client';

/** A Redis whose every read throws — simulates the store being unreachable. */
const throwingRedis = (): RedisLike =>
  ({
    get: async () => {
      throw new Error('redis down');
    },
    set: async () => {
      throw new Error('redis down');
    },
  }) as unknown as RedisLike;

// BLOCKER-5: the single most important safety property is what happens when the
// emergency-controls store is unreachable. The kill switch MUST fail CLOSED (pause
// money/AI, go read-only) — previously this was asserted only in code comments and
// one refactor away from silently flipping to fail-dangerous with green CI.
describe('emergency controls — Redis-down fail-safety (BLOCKER-5)', () => {
  afterEach(() => __setEmergencyRedisForTest(null)); // restore real redis + clear cache

  it('a cold read failure with no cache FAILS CLOSED (money/AI paused, read-only, reads survive)', async () => {
    __setEmergencyRedisForTest(throwingRedis()); // also clears the in-process cache
    const c = await getControls();
    assert.equal(c.trading, false, 'trading must be paused');
    assert.equal(c.ai, false, 'AI must be paused');
    assert.equal(c.packs, false, 'packs must be paused');
    assert.equal(c.cashback, false, 'cashback must be paused');
    assert.equal(c.referral, false, 'referral must be paused');
    assert.equal(c.readOnly, true, 'writes must be blocked');
    assert.equal(c.maintenance, false, 'reads must still work (not full maintenance)');
    assert.equal(c.chains.sol, false);
    assert.equal(c.chains.ton, false);
  });

  it('every money/AI guard is BLOCKED while Redis is down (fail-closed is not cached, so it holds)', async () => {
    __setEmergencyRedisForTest(throwingRedis());
    const isBlocked = (e: unknown) => e instanceof EmergencyBlockedError;
    await assert.rejects(() => assertTradingAllowed('sol'), isBlocked);
    await assert.rejects(() => assertPacksAllowed(), isBlocked);
    await assert.rejects(() => assertWriteAllowed(), isBlocked);
    await assert.rejects(() => assertAiAllowed(), isBlocked);
    assert.equal(await isReadOnly(), true);
  });
});
