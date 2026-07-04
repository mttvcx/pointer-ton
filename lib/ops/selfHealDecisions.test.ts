import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideSelfHeal, matchActions, planSelfHeal } from '@/lib/ops/selfHealDecisions';

describe('self-heal — matching', () => {
  it('matches actions to finding ids', () => {
    assert.deepEqual(matchActions('webhook-dlq-growing').map((a) => a.id), ['drain-webhook-dlq']);
    assert.deepEqual(matchActions('indexer-backlog').map((a) => a.id), ['retry-failed-indexes']);
    assert.ok(matchActions('provider-unconfigured-helius').some((a) => a.id === 'cutoff-provider'));
    assert.deepEqual(matchActions('totally-unrelated'), []);
  });
});

describe('self-heal — safety contract', () => {
  it('DANGEROUS actions always escalate — even enabled + high confidence', () => {
    const [d] = decideSelfHeal({ findingId: 'provider-down-helius', confidence: 1, enabled: true });
    assert.equal(d!.action.danger, 'dangerous');
    assert.equal(d!.mode, 'escalate');
  });

  it('observe-only (flag off): safe actions are RECOMMENDED, never executed', () => {
    const [d] = decideSelfHeal({ findingId: 'webhook-dlq', confidence: 1, enabled: false });
    assert.equal(d!.mode, 'recommend');
  });

  it('enabled + safe + confident → EXECUTE', () => {
    const [d] = decideSelfHeal({ findingId: 'webhook-dlq', confidence: 0.9, enabled: true });
    assert.equal(d!.mode, 'execute');
  });

  it('enabled + safe but LOW confidence → recommend (not executed)', () => {
    const [d] = decideSelfHeal({ findingId: 'webhook-dlq', confidence: 0.3, enabled: true });
    assert.equal(d!.mode, 'recommend');
  });
});

describe('self-heal — planSelfHeal', () => {
  it('dedupes per action; highest mode wins', () => {
    const plan = planSelfHeal(
      [
        { id: 'webhook-dlq-a', score: { confidence: 0.3 } }, // would recommend
        { id: 'webhook-dlq-b', score: { confidence: 0.9 } }, // would execute
        { id: 'provider-down', score: { confidence: 0.95 } }, // escalate
      ],
      true,
    );
    const dlq = plan.find((p) => p.action.id === 'drain-webhook-dlq');
    const prov = plan.find((p) => p.action.id === 'cutoff-provider');
    assert.equal(dlq?.mode, 'execute'); // the confident one wins over the low one
    assert.equal(prov?.mode, 'escalate');
  });

  it('observe-only plan executes nothing', () => {
    const plan = planSelfHeal([{ id: 'webhook-dlq', score: { confidence: 1 } }], false);
    assert.ok(plan.every((p) => p.mode !== 'execute'));
  });
});
