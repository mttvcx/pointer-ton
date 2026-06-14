import assert from 'node:assert/strict';
import test from 'node:test';
import { LAUNCHPAD_PROGRAM_IDS } from '@/lib/utils/constants';
import { classifyTokenProtocol, parseGeckoDexProtocol } from '@/lib/protocol/classifyTokenProtocol';
import { filterIdsFromTokenRow, filterIdsFromTokenBundle } from '@/lib/protocol/filterIds';
import { shouldApplyClassification } from '@/lib/protocol/classifyCore';
import { ingestHintFromSource } from '@/lib/protocol/buildClassifierInput';
import { supportedFilterIdsForChain } from '@/lib/protocol/registry';
import {
  resolveLaunchpadProtocolFromBundle,
  resolveLaunchpadAvatarChrome,
} from '@/lib/tokens/launchpadAvatarChrome';

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

test('filter bundle resolves heaven from launch_pad without db protocol_id', () => {
  const ids = filterIdsFromTokenBundle(
    {
      token: {
        mint: 'So11111111111111111111111111111111111111112',
        launch_pad: 'heaven',
        created_at: new Date().toISOString(),
      },
      snapshot: null,
    },
    'sol',
  );
  assert.ok(ids.includes('heaven'));
});

test('filter bundle resolves pancakeswap from dexId on bnb', () => {
  const ids = filterIdsFromTokenBundle(
    {
      token: {
        mint: '0xabc123',
        launch_pad: null,
        created_at: new Date().toISOString(),
      },
      snapshot: {
        extended_metrics: { dexId: 'pancakeswap' },
      } as never,
    },
    'bnb',
  );
  assert.ok(ids.includes('pancakeswap'));
});

test('supported filter ids include base launch venues', () => {
  const base = supportedFilterIdsForChain('base');
  assert.ok(base.includes('clanker'));
  assert.ok(base.includes('bankr'));
  assert.ok(base.includes('zora-content'));
});

test('avatar ring uses clanker not base when launch_pad is set', () => {
  const id = resolveLaunchpadProtocolFromBundle(
    {
      token: {
        mint: '0xabc',
        launch_pad: 'clanker',
        protocol_id: 'base',
        source_confidence: 0.65,
        created_at: new Date().toISOString(),
      },
      snapshot: null,
    },
    'base',
  );
  assert.equal(id, 'clanker');
});

test('avatar ring uses pancakeswap from dexId over generic bsc protocol_id', () => {
  const id = resolveLaunchpadProtocolFromBundle(
    {
      token: {
        mint: '0xabc',
        launch_pad: null,
        protocol_id: 'bsc',
        source_confidence: 0.65,
        created_at: new Date().toISOString(),
      },
      snapshot: {
        extended_metrics: { dexId: 'pancakeswap' },
      } as never,
    },
    'bnb',
  );
  assert.equal(id, 'pancakeswap');
});

test('avatar ring never falls back to chain bucket', () => {
  const id = resolveLaunchpadProtocolFromBundle(
    {
      token: {
        mint: '0xabc',
        launch_pad: null,
        protocol_id: 'eth',
        source_confidence: 0.65,
        created_at: new Date().toISOString(),
      },
      snapshot: null,
    },
    'eth',
  );
  assert.equal(id, null);
  const chrome = resolveLaunchpadAvatarChrome(
    {
      token: {
        mint: '0xabc',
        launch_pad: null,
        protocol_id: 'eth',
        source_confidence: 0.65,
        created_at: new Date().toISOString(),
      },
      snapshot: null,
    },
    { chain: 'eth' },
  );
  assert.equal(chrome, null);
});

test('avatar ring resolves four.meme from metadata source', () => {
  const id = resolveLaunchpadProtocolFromBundle(
    {
      token: {
        mint: '0xabc',
        launch_pad: null,
        protocol_id: 'bsc',
        source_confidence: 0.65,
        raw_metadata: { source: 'four.meme', F: 12 },
        created_at: new Date().toISOString(),
      },
      snapshot: null,
    },
    'bnb',
  );
  assert.equal(id, 'four.meme');
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

test('classify pump.fun from mint suffix ending in pump', () => {
  const c = classifyTokenProtocol({
    mint: 'H9D6zuYzL35aZZV4MxRc3H5nAJb8M4kxK38HCUGypump',
    ingest_hint: 'helius_das_search',
  });
  assert.equal(c.protocol_id, 'pump_fun');
  assert.equal(c.classification_source, 'helius_das_uri');
  assert.ok(c.source_confidence >= 0.5);
});

test('classify Bonk from symbol/name metadata (not URI)', () => {
  const c = classifyTokenProtocol({
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    raw_metadata: {
      content: {
        metadata: { symbol: 'Bonk', name: 'Bonk' },
        json_uri: 'https://example.com/metadata.json',
      },
    },
    ingest_hint: 'helius_das_hydrate',
  });
  assert.equal(c.protocol_id, 'bonk');
  assert.equal(c.classification_source, 'helius_das_uri');
  assert.ok(c.source_confidence >= 0.5);
  assert.notEqual(c.classification_source, 'helius_das_authority');
});

test('plain random SPL stays unknown with honest das_search source', () => {
  const c = classifyTokenProtocol({
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    raw_metadata: { content: { metadata: { symbol: 'USDC', name: 'USD Coin' } } },
    ingest_hint: 'helius_das_search',
  });
  assert.equal(c.protocol_id, null);
  assert.equal(c.classification_source, 'helius_das_search');
  assert.equal(c.source_confidence, 0);
});

test('das_authority pad classifies pump token at high confidence', () => {
  const c = classifyTokenProtocol({
    mint: 'So11111111111111111111111111111111111111112',
    das_authority_pad: 'pump.fun',
    ingest_hint: 'helius_das_authority',
  });
  assert.equal(c.protocol_id, 'pump_fun');
  assert.equal(c.classification_source, 'helius_das_authority');
  assert.ok(c.source_confidence >= 0.9);
});

test('ingestHintFromSource maps das paths honestly', () => {
  assert.equal(ingestHintFromSource('das_search'), 'helius_das_search');
  assert.equal(ingestHintFromSource('das_hydrate'), 'helius_das_hydrate');
  assert.equal(ingestHintFromSource('das_authority'), 'helius_das_authority');
});
