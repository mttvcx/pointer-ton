import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyAction,
  availableActions,
  canTransition,
  INCIDENT_STATUSES,
  isActive,
  isResolved,
} from '@/lib/ops/incidentLifecycle';

describe('incident lifecycle — transitions', () => {
  it('the happy path open→…→resolved is valid', () => {
    assert.ok(canTransition('open', 'acknowledged'));
    assert.ok(canTransition('acknowledged', 'investigating'));
    assert.ok(canTransition('investigating', 'mitigated'));
    assert.ok(canTransition('mitigated', 'resolved'));
  });
  it('forward skips are allowed (false-alarm → straight to resolved)', () => {
    assert.ok(canTransition('open', 'resolved'));
    assert.ok(canTransition('open', 'mitigated'));
  });
  it('resolved can be reopened; mitigated can go back to investigating', () => {
    assert.ok(canTransition('resolved', 'open'));
    assert.ok(canTransition('mitigated', 'investigating'));
  });
  it('rejects no-op and invalid backward moves', () => {
    assert.equal(canTransition('open', 'open'), false);
    assert.equal(canTransition('resolved', 'mitigated'), false);
    assert.equal(canTransition('investigating', 'acknowledged'), false);
  });
});

describe('incident lifecycle — applyAction', () => {
  it('maps actions to the right next status', () => {
    assert.equal(applyAction('open', 'acknowledge'), 'acknowledged');
    assert.equal(applyAction('acknowledged', 'investigate'), 'investigating');
    assert.equal(applyAction('investigating', 'mitigate'), 'mitigated');
    assert.equal(applyAction('mitigated', 'resolve'), 'resolved');
    assert.equal(applyAction('resolved', 'reopen'), 'open');
  });
  it('returns null for an action invalid from the current status', () => {
    assert.equal(applyAction('open', 'reopen'), null); // can't reopen an open incident
    assert.equal(applyAction('resolved', 'acknowledge'), null);
  });
});

describe('incident lifecycle — helpers', () => {
  it('availableActions never includes an invalid action', () => {
    for (const s of INCIDENT_STATUSES) {
      for (const a of availableActions(s)) {
        assert.ok(applyAction(s, a) !== null);
      }
    }
  });
  it('isResolved / isActive', () => {
    assert.equal(isResolved('resolved'), true);
    assert.equal(isActive('resolved'), false);
    assert.equal(isActive('open'), true);
  });
});
