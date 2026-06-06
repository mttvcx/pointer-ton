import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  outcomeRequiresApproval,
  isOverrideClaimable,
  canApproveOverride,
  HIGH_VALUE_OUTCOMES,
} from '@/lib/packs/overridePolicy';

describe('pack override policy — approval gating', () => {
  it('high-value outcomes require approval', () => {
    assert.equal(outcomeRequiresApproval('jackpot'), true);
    assert.equal(outcomeRequiresApproval('legendary_elite'), true);
    assert.ok(HIGH_VALUE_OUTCOMES.has('jackpot'));
  });

  it('epic_surge is auto-approvable (low value)', () => {
    assert.equal(outcomeRequiresApproval('epic_surge'), false);
  });

  it('approver must differ from creator', () => {
    assert.equal(canApproveOverride({ approverUserId: 'a', createdByUserId: 'b' }), true);
    assert.equal(canApproveOverride({ approverUserId: 'a', createdByUserId: 'a' }), false);
  });

  it('system break-glass cannot approve', () => {
    assert.equal(canApproveOverride({ approverUserId: 'system', createdByUserId: 'b' }), false);
  });

  it('null creator can be approved by any real admin', () => {
    assert.equal(canApproveOverride({ approverUserId: 'a', createdByUserId: null }), true);
  });
});

describe('pack override policy — claim eligibility', () => {
  const future = new Date(Date.now() + 60_000).toISOString();
  const past = new Date(Date.now() - 60_000).toISOString();

  it('claims an approved, unexpired, unconsumed, matching override', () => {
    assert.equal(
      isOverrideClaimable({ status: 'approved', consumed_open_id: null, expires_at: future, pack_type: 'gold' }, 'gold'),
      true,
    );
  });

  it('wildcard pack_type matches any pack', () => {
    assert.equal(
      isOverrideClaimable({ status: 'approved', consumed_open_id: null, expires_at: future, pack_type: null }, 'bronze'),
      true,
    );
  });

  it('rejects pending overrides', () => {
    assert.equal(
      isOverrideClaimable({ status: 'pending', consumed_open_id: null, expires_at: future, pack_type: null }, 'gold'),
      false,
    );
  });

  it('rejects expired overrides', () => {
    assert.equal(
      isOverrideClaimable({ status: 'approved', consumed_open_id: null, expires_at: past, pack_type: null }, 'gold'),
      false,
    );
  });

  it('rejects already-consumed overrides', () => {
    assert.equal(
      isOverrideClaimable({ status: 'approved', consumed_open_id: 'open-1', expires_at: future, pack_type: null }, 'gold'),
      false,
    );
  });

  it('rejects pack-type mismatch', () => {
    assert.equal(
      isOverrideClaimable({ status: 'approved', consumed_open_id: null, expires_at: future, pack_type: 'gold' }, 'silver'),
      false,
    );
  });
});
