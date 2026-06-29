import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EXTENSION_READINESS, summarizeReadiness, type ReadinessItem } from '@/lib/extension/readiness';

describe('extension readiness', () => {
  it('every item has a unique key + valid status/category', () => {
    const keys = new Set<string>();
    for (const i of EXTENSION_READINESS) {
      assert.ok(!keys.has(i.key), `dup key ${i.key}`);
      keys.add(i.key);
      assert.ok(['done', 'in_progress', 'blocked', 'todo'].includes(i.status));
      assert.ok(['injection', 'chrome', 'auth', 'release'].includes(i.category));
    }
  });

  it('summary counts add up and percent is 0–100', () => {
    const s = summarizeReadiness();
    assert.equal(s.done + s.in_progress + s.blocked + s.todo, s.total);
    assert.ok(s.percent >= 0 && s.percent <= 100);
  });

  it('ready only when ALL items are done', () => {
    const allTodo: ReadinessItem[] = [{ key: 'x', label: 'x', category: 'chrome', status: 'todo' }];
    assert.equal(summarizeReadiness(allTodo).ready, false);
    const allDone: ReadinessItem[] = [{ key: 'x', label: 'x', category: 'chrome', status: 'done' }];
    assert.equal(summarizeReadiness(allDone).ready, true);
    assert.equal(summarizeReadiness(allDone).percent, 100);
  });

  it('is not ready today (extension work has not started)', () => {
    assert.equal(summarizeReadiness().ready, false);
  });
});
