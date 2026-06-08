import assert from 'node:assert/strict';
import test from 'node:test';
import { LAUNCHPAD_PROGRAM_IDS } from '@/lib/utils/constants';
import { classifyTokenProtocol, parseGeckoDexProtocol } from '@/lib/protocol/classifyTokenProtocol';
import { filterIdsFromTokenRow } from '@/lib/protocol/filterIds';
import { shouldApplyClassification } from '@/lib/protocol/classifyCore';

test('classify pump.fun from program id', () => {
  const c = classifyTokenProtocol({
    mint: 'So11111111111111111111111111111111111111112',
    solana_program_id: LAUNCHPAD_PROGRAM_IDS.pumpFun,
    ingest_hint: 'helius_webhook_program',
  });
  assert.equal(c.protocol_id, 'pump_fun');
  assert.equal(c.token_kind, 'bonding_curve');
  assert.ok(c.source_confidence >= 0.9);
});

test('classify pump_fun_mayhem only with structured flag', () => {
  const c = classifyTokenProtocol({
    mint: 'So11111111111111111111111111111111111111112',
    solana_program_id: LAUNCHPAD_PROGRAM_IDS.pumpFun,
    raw_metadata: { mayhemMode: true },
  });
  assert.equal(c.protocol_id, 'pump_fun_mayhem');
});

test('classify migrated pump with dex', () => {
  const c = classifyTokenProtocol({
    mint: 'So11111111111111111111111111111111111111112',
    launch_pad: 'pump.fun',
    migrated_at: new Date().toISOString(),
    migrated_to: 'pumpswap',
    ingest_hint: 'migration_program',
  });
  assert.equal(c.protocol_id, 'pump_fun');
  assert.equal(c.migration_state, 'migrated');
  assert.equal(c.token_kind, 'amm_pool');
  assert.equal(c.dex_id, 'pumpswap');
});

test('parse gecko pancakeswap dex', () => {
  const parsed = parseGeckoDexProtocol(
    { relationships: { dex: { data: { id: 'bsc_pancakeswap_v3' } } } },
    'bsc',
  );
  assert.equal(parsed?.protocol_id, 'pancakeswap');
});

test('filter ids require confidence threshold', () => {
  assert.deepEqual(
    filterIdsFromTokenRow({ protocol_id: 'pump_fun', source_confidence: 0.97 }),
    ['pump.fun'],
  );
  assert.deepEqual(filterIdsFromTokenRow({ protocol_id: 'pump_fun', source_confidence: 0.2 }), []);
});

test('should not overwrite higher confidence', () => {
  const incoming = classifyTokenProtocol({
    mint: 'x',
    launch_pad: 'bonk',
    ingest_hint: 'launch_pad_legacy',
  });
  assert.equal(shouldApplyClassification({ source_confidence: 0.97, protocol_id: 'bonk' }, incoming), false);
});

test('generic ton jetton', () => {
  const c = classifyTokenProtocol({
    mint: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c',
    launch_pad: 'ton',
    ingest_hint: 'tonapi_jetton',
  });
  assert.equal(c.protocol_id, 'ton');
  assert.equal(c.token_kind, 'native_jetton');
});
