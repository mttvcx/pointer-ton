import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  backoffMs,
  decideRetry,
  DEFAULT_WEBHOOK_RETRY,
  jitterFromId,
  type WebhookRetryConfig,
} from '@/lib/webhooks/retryPolicy';

const CFG: WebhookRetryConfig = { maxAttempts: 5, baseMs: 1000, maxMs: 60_000 };

describe('webhooks: backoffMs', () => {
  it('is exponential in the attempt number (no jitter at 0.5 midpoint)', () => {
    // factor at jitter01=0.5 is exactly 1.0 → raw values
    assert.equal(backoffMs(1, CFG, 0.5), 1000);
    assert.equal(backoffMs(2, CFG, 0.5), 2000);
    assert.equal(backoffMs(3, CFG, 0.5), 4000);
    assert.equal(backoffMs(4, CFG, 0.5), 8000);
  });

  it('caps at maxMs', () => {
    assert.equal(backoffMs(20, CFG, 0.5), 60_000); // 2^19 * 1000 >> cap
  });

  it('jitter stays within ±12.5% of the capped value', () => {
    for (const j of [0, 0.25, 0.5, 0.75, 0.999]) {
      const v = backoffMs(3, CFG, j); // base capped value = 4000
      assert.ok(v >= 4000 * 0.875 - 1, `>= floor for ${j}: ${v}`);
      assert.ok(v <= 4000 * 1.125 + 1, `<= ceil for ${j}: ${v}`);
    }
  });

  it('treats attempt < 1 as 1', () => {
    assert.equal(backoffMs(0, CFG, 0.5), 1000);
    assert.equal(backoffMs(-3, CFG, 0.5), 1000);
  });
});

describe('webhooks: decideRetry', () => {
  it('schedules a retry while attempts remain, due in the future', () => {
    const d = decideRetry(1, 1_000_000, CFG, 0.5);
    assert.equal(d.action, 'retry');
    if (d.action === 'retry') {
      assert.equal(d.attempt, 1);
      assert.equal(d.delayMs, 1000);
      assert.equal(d.dueAtMs, 1_001_000);
    }
  });

  it('dead-letters once attempts reach maxAttempts', () => {
    assert.equal(decideRetry(5, 0, CFG, 0.5).action, 'dead');
    assert.equal(decideRetry(6, 0, CFG, 0.5).action, 'dead');
  });

  it('the attempt just before the cap still retries', () => {
    assert.equal(decideRetry(4, 0, CFG, 0.5).action, 'retry');
  });

  it('default config retries several times before dead-lettering', () => {
    assert.equal(decideRetry(1, 0, DEFAULT_WEBHOOK_RETRY).action, 'retry');
    assert.equal(decideRetry(DEFAULT_WEBHOOK_RETRY.maxAttempts, 0, DEFAULT_WEBHOOK_RETRY).action, 'dead');
  });
});

describe('webhooks: jitterFromId', () => {
  it('is deterministic for the same id', () => {
    assert.equal(jitterFromId('abc123'), jitterFromId('abc123'));
  });

  it('stays within [0,1)', () => {
    for (const id of ['', 'a', 'sig_9f8e7d', 'x'.repeat(64)]) {
      const j = jitterFromId(id);
      assert.ok(j >= 0 && j < 1, `${id} -> ${j}`);
    }
  });

  it('different ids generally differ', () => {
    assert.notEqual(jitterFromId('sigA'), jitterFromId('sigB'));
  });
});
