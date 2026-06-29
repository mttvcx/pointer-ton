import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { demoWalletAt } from '@/lib/dev/demoTokenFixtures';
import { parseGmgnExport } from '@/lib/identity/providers/gmgnParse';
import { expandSeedRowsToEvmChains } from '@/lib/identity/expandEvmChains';
import { parseManualJsonImport, parseManualCsvImport } from '@/lib/identity/providers/manualImport';
import { parseAxiomTerminalExport } from '@/lib/identity/providers/axiomTerminal';
import { importIdentitySeeds } from '@/lib/identity/identityService';
import { getWalletEntry, listRegistryStats } from '@/lib/identity/registry';

describe('wallet identity import', () => {
  it('parses manual JSON seed rows', () => {
    const rows = parseManualJsonImport([
      {
        chain: 'solana',
        address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
        displayName: 'Doji',
        source: 'kolscan',
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.source, 'kolscan');
  });

  it('parses GMGN track export with empty name (address fallback)', () => {
    const rows = parseGmgnExport(
      [{ address: '2kv8X2a9bxnBM8NKLc6BBTX2z13GFNRL4oRotMUJRva9', name: '', emoji: '' }],
      'sol',
    );
    assert.equal(rows.length, 1);
    assert.ok(rows[0]!.displayName.length > 0);
    assert.equal(rows[0]!.source, 'gmgn');
  });

  it('loads GMGN Wallet 20 committed seed', () => {
    const cented = getWalletEntry('sol', 'CyaE1VxvBrahnPWkqm5VsdCvyS2QmNht2UFrKJHga54o');
    assert.ok(cented);
    assert.equal(cented!.profile.displayName, 'Cented');
    assert.ok(listRegistryStats().walletCount >= 32);
  });

  it('loads Axiom KOL sol seed with twitter handles', () => {
    const dv = getWalletEntry('sol', 'BCagckXeMChUKrHEd6fKFA1uiWDtcmCXMsqaheLiUPJd');
    assert.ok(dv);
    assert.equal(dv!.profile.displayName, 'dvces');
    assert.equal(dv!.profile.twitterHandle, 'vibed333');
    assert.ok(listRegistryStats().walletCount >= 110);
  });

  it('loads GMGN EVM Wallet 20 on eth, bnb, and base', () => {
    const addr = '0xa7dcc417c63f24f9073b667a5d7149bd38463d0f';
    assert.ok(getWalletEntry('eth', addr));
    assert.ok(getWalletEntry('bnb', addr));
    assert.ok(getWalletEntry('base', addr));
    assert.equal(getWalletEntry('bnb', addr)!.profile.displayName, 'H.E. ZEPUMP');
    assert.ok(listRegistryStats().walletCount >= 110);
  });

  it('expandSeedRowsToEvmChains fans out 20 rows to 60', () => {
    const base = parseGmgnExport(
      [{ address: '0xa7dcc417c63f24f9073b667a5d7149bd38463d0f', name: 'Cowboy', emoji: '' }],
      'eth',
    );
    const expanded = expandSeedRowsToEvmChains(base);
    assert.equal(expanded.length, 3);
  });

  it('parses manual CSV bulk paste', () => {
    const csv = `chain,address,displayName,source,category,twitter
sol,9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM,Doji,kolscan,kol,doji_sol`;
    const rows = parseManualCsvImport(csv);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.displayName, 'Doji');
  });

  it('parses Axiom manual wallet list', () => {
    const rows = parseAxiomTerminalExport(
      [{ walletAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', name: 'Doji' }],
      'sol',
      'axiom',
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.source, 'axiom');
  });

  it('imports bulk rows into in-memory registry', () => {
    const before = listRegistryStats().walletCount;
    const batch = Array.from({ length: 50 }, (_, i) => ({
      chain: 'solana' as const,
      address: demoWalletAt(i + 100),
      displayName: `KOL ${i}`,
      source: 'manual',
      category: 'kol' as const,
      badges: ['KOL' as const],
      confidence: 0.7,
    }));
    const { imported } = importIdentitySeeds(batch);
    assert.ok(imported >= 20);
    assert.ok(listRegistryStats().walletCount > before);
  });
});

describe('registry seed lookup after import', () => {
  it('finds imported wallet by address', () => {
    importIdentitySeeds([
      {
        chain: 'solana',
        address: '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S',
        displayName: 'Import Test',
        source: 'manual',
        category: 'kol',
        badges: ['KOL'],
        confidence: 0.9,
      },
    ]);
    const hit = getWalletEntry('sol', '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S');
    assert.ok(hit);
    assert.equal(hit!.profile.displayName, 'Import Test');
  });
});
