import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EMERGENCY_CHAINS,
  EmergencyBlockedError,
  decideAi,
  decideCashback,
  decidePacks,
  decideReferral,
  decideTrading,
  decideWrite,
  defaultControls,
  failClosedControls,
  normalizeControls,
  type EmergencyControls,
} from '@/lib/emergency/decisions';

function withPatch(p: Partial<EmergencyControls>): EmergencyControls {
  return normalizeControls({ ...defaultControls(), ...p });
}

describe('emergency: defaults allow everything', () => {
  const c = defaultControls();
  it('every decision passes', () => {
    assert.equal(decideTrading(c), null);
    for (const ch of EMERGENCY_CHAINS) assert.equal(decideTrading(c, ch), null);
    assert.equal(decideAi(c), null);
    assert.equal(decidePacks(c), null);
    assert.equal(decideCashback(c), null);
    assert.equal(decideReferral(c), null);
    assert.equal(decideWrite(c), null);
  });
});

describe('emergency: FAIL CLOSED blocks every protected path', () => {
  const c = failClosedControls();
  it('trading/ai/packs/cashback/referral/write all blocked', () => {
    assert.ok(decideTrading(c) instanceof EmergencyBlockedError);
    assert.ok(decideAi(c) instanceof EmergencyBlockedError);
    assert.ok(decidePacks(c) instanceof EmergencyBlockedError);
    assert.ok(decideCashback(c) instanceof EmergencyBlockedError);
    assert.ok(decideReferral(c) instanceof EmergencyBlockedError);
    assert.ok(decideWrite(c) instanceof EmergencyBlockedError);
  });
  it('every chain blocked', () => {
    for (const ch of EMERGENCY_CHAINS) assert.ok(decideTrading(c, ch) instanceof EmergencyBlockedError);
  });
  it('reads still allowed (maintenance stays false)', () => {
    assert.equal(c.maintenance, false);
  });
});

describe('emergency: global kill switches', () => {
  it('trading off blocks trading only', () => {
    const c = withPatch({ trading: false });
    assert.equal(decideTrading(c)?.code, 'trading_paused');
    assert.equal(decideAi(c), null); // unrelated switch unaffected
  });
  it('ai off blocks ai only', () => {
    const c = withPatch({ ai: false });
    assert.equal(decideAi(c)?.code, 'ai_paused');
    assert.equal(decideTrading(c), null);
  });
  it('packs/cashback/referral off block their own path', () => {
    assert.equal(decidePacks(withPatch({ packs: false }))?.code, 'packs_paused');
    assert.equal(decideCashback(withPatch({ cashback: false }))?.code, 'cashback_paused');
    assert.equal(decideReferral(withPatch({ referral: false }))?.code, 'referral_paused');
  });
});

describe('emergency: per-chain kill switch', () => {
  it('pausing one chain blocks only that chain', () => {
    const c = withPatch({ chains: { ...defaultControls().chains, base: false } });
    assert.equal(decideTrading(c, 'base')?.code, 'chain_paused');
    assert.equal(decideTrading(c, 'sol'), null);
    assert.equal(decideTrading(c), null); // global (no chain) still allowed
  });
});

describe('emergency: maintenance + read-only', () => {
  it('maintenance blocks trading/ai/packs/write', () => {
    const c = withPatch({ maintenance: true });
    assert.equal(decideTrading(c)?.code, 'maintenance');
    assert.equal(decideAi(c)?.code, 'maintenance');
    assert.equal(decidePacks(c)?.code, 'maintenance');
    assert.equal(decideWrite(c)?.code, 'maintenance');
  });
  it('read-only blocks writes/trading/packs but NOT ai reads', () => {
    const c = withPatch({ readOnly: true });
    assert.equal(decideTrading(c)?.code, 'read_only');
    assert.equal(decidePacks(c)?.code, 'read_only');
    assert.equal(decideWrite(c)?.code, 'read_only');
    assert.equal(decideAi(c), null); // AI is not a write — read-only doesn't pause it
  });
});

describe('emergency: normalizeControls merges partial / legacy blobs', () => {
  it('null → full defaults', () => {
    assert.deepEqual(normalizeControls(null), defaultControls());
  });
  it('partial keeps unspecified keys as defaults', () => {
    const c = normalizeControls({ trading: false });
    assert.equal(c.trading, false);
    assert.equal(c.ai, true);
    assert.equal(c.chains.sol, true);
  });
  it('partial chains merge onto default chains', () => {
    const c = normalizeControls({ chains: { eth: false } as EmergencyControls['chains'] });
    assert.equal(c.chains.eth, false);
    assert.equal(c.chains.sol, true);
  });
  it('rejects a malformed banner', () => {
    const c = normalizeControls({ banner: { level: 'warn' } as unknown as EmergencyControls['banner'] });
    assert.equal(c.banner, null);
  });
  it('non-boolean switch values fall back to default', () => {
    const c = normalizeControls({ trading: 'nope' as unknown as boolean });
    assert.equal(c.trading, true);
  });
});
