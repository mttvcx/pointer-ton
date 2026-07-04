import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hasPermission } from '@/lib/admin/permissions';
import {
  ACCOUNT_CONTROL_PERMISSION,
  ACCOUNT_FREEZE_AUDIT_ACTION,
  ACCOUNT_RELEASE_AUDIT_ACTION,
} from '@/lib/admin/accountControlPolicy';
import {
  blocksActivityForKind,
  gateFromFreezeLookup,
  gateFromLookupFailure,
  tradingFreezeGateHttpPayload,
} from '@/lib/account/tradingFreezeGate';

const FROZEN_TRADING = { status: 'frozen', scope: 'trading' as const };
const FROZEN_AUTOMATION = { status: 'frozen', scope: 'automation' as const };
const FROZEN_ALL = { status: 'frozen', scope: 'all' as const };
const RELEASED = { status: 'released', scope: 'all' as const };

describe('Account Guardian — trading freeze scope', () => {
  it('frozen user (trading scope) is blocked from trading', () => {
    assert.equal(blocksActivityForKind(FROZEN_TRADING, 'trading'), true);
    const gate = gateFromFreezeLookup(blocksActivityForKind(FROZEN_TRADING, 'trading'));
    assert.equal(gate.allowed, false);
    if (!gate.allowed) {
      assert.equal(gate.error, 'account_frozen');
      assert.equal(gate.status, 423);
    }
  });

  it('frozen user (all scope) is blocked from trading — quote/execute gate', () => {
    assert.equal(blocksActivityForKind(FROZEN_ALL, 'trading'), true);
    const payload = tradingFreezeGateHttpPayload(gateFromFreezeLookup(true));
    assert.ok(payload);
    assert.equal(payload!.status, 423);
    assert.equal(payload!.body.error, 'account_frozen');
  });

  it('released user can trade again', () => {
    assert.equal(blocksActivityForKind(RELEASED, 'trading'), false);
    assert.equal(blocksActivityForKind(null, 'trading'), false);
    const gate = gateFromFreezeLookup(false);
    assert.equal(gate.allowed, true);
    assert.equal(tradingFreezeGateHttpPayload(gate), null);
  });

  it('automation-only freeze does not block trading quote/execute', () => {
    assert.equal(blocksActivityForKind(FROZEN_AUTOMATION, 'trading'), false);
    const gate = gateFromFreezeLookup(false);
    assert.equal(gate.allowed, true);
  });
});

describe('Account Guardian — automation-kind enforcement (trackers / alert rules)', () => {
  it('automation-scope freeze blocks automation but not trading', () => {
    assert.equal(blocksActivityForKind(FROZEN_AUTOMATION, 'automation'), true);
    assert.equal(blocksActivityForKind(FROZEN_AUTOMATION, 'trading'), false);
  });

  it('all-scope freeze blocks BOTH trading and automation (no bypass)', () => {
    assert.equal(blocksActivityForKind(FROZEN_ALL, 'trading'), true);
    assert.equal(blocksActivityForKind(FROZEN_ALL, 'automation'), true);
  });

  it('trading-only freeze does NOT block automation', () => {
    assert.equal(blocksActivityForKind(FROZEN_TRADING, 'automation'), false);
  });

  it('released / no control blocks neither kind', () => {
    for (const kind of ['trading', 'automation'] as const) {
      assert.equal(blocksActivityForKind(RELEASED, kind), false);
      assert.equal(blocksActivityForKind(null, kind), false);
    }
  });

  it('a blocked automation lookup gates with 423 account_frozen', () => {
    const payload = tradingFreezeGateHttpPayload(
      gateFromFreezeLookup(blocksActivityForKind(FROZEN_AUTOMATION, 'automation')),
    );
    assert.ok(payload);
    assert.equal(payload!.status, 423);
    assert.equal(payload!.body.error, 'account_frozen');
  });
});

describe('Account Guardian — fail-closed on lookup uncertainty', () => {
  it('account control lookup error blocks quote/execute with 503', () => {
    const gate = gateFromLookupFailure(new Error('getActiveControl failed: connection reset'));
    assert.equal(gate.allowed, false);
    if (!gate.allowed) {
      assert.equal(gate.error, 'account_control_unavailable');
      assert.equal(gate.status, 503);
      assert.match(gate.message, /verified/i);
    }
    const payload = tradingFreezeGateHttpPayload(gate);
    assert.ok(payload);
    assert.equal(payload!.status, 503);
    assert.equal(payload!.body.error, 'account_control_unavailable');
  });

  it('successful lookup with no active freeze allows trading', () => {
    const gate = gateFromFreezeLookup(false);
    assert.equal(gate.allowed, true);
  });
});

describe('Account Guardian — admin RBAC and audit contract', () => {
  it('freeze/release requires account.control permission', () => {
    assert.equal(ACCOUNT_CONTROL_PERMISSION, 'account.control');
    assert.equal(hasPermission(['account.control'], ACCOUNT_CONTROL_PERMISSION), true);
    assert.equal(hasPermission(['users.read'], ACCOUNT_CONTROL_PERMISSION), false);
    assert.equal(hasPermission(['*'], ACCOUNT_CONTROL_PERMISSION), true);
  });

  it('freeze/release audit action ids are stable for audit log', () => {
    assert.equal(ACCOUNT_FREEZE_AUDIT_ACTION, 'account.freeze');
    assert.equal(ACCOUNT_RELEASE_AUDIT_ACTION, 'account.release');
  });
});
