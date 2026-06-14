import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseKolscanLeaderboardPaste,
  importKolscanLeaderboardPaste,
} from '@/lib/identity/providers/kolscanParse';
import {
  parseAxiomKolPaste,
  importAxiomKolPaste,
} from '@/lib/identity/providers/axiomKolParse';
import { importKolLabelPaste } from '@/lib/identity/resolveKolLabelPaste';
import {
  matchesPartialAddress,
  resolvePartialAddress,
} from '@/lib/identity/resolvePartialAddress';

const KNOWN = [
  'CyaE1VxvBrahnPWkqm5VsdCvyS2QmNht2UFrKJHga54o',
  '2kv8X2a9bxnBM8NKLc6BBTX2z13GFNRL4oRotMUJRva9',
  'Bi4rd5FH5bYEN8scZ7wevxNZyNmKHdaBcvewdPFxYdLt',
];

describe('partial address resolution', () => {
  it('matches prefix-only Kolscan partial', () => {
    assert.ok(matchesPartialAddress(KNOWN[0]!, 'CyaE1V'));
  });

  it('matches Axiom prefix…suffix partial', () => {
    assert.ok(matchesPartialAddress(KNOWN[1]!, '2kv8...Rva9'));
  });

  it('resolves unique prefix against pool', () => {
    const hit = resolvePartialAddress('Bi4rd5', KNOWN);
    assert.equal(hit.address, KNOWN[2]);
  });
});

describe('Axiom KOL paste parser', () => {
  const sample = `dvces
@vibed333
BCag...UPJd

Gh0stee
@gh0stee
2kv8...Rva9`;

  it('parses name / handle / partial blocks', () => {
    const rows = parseAxiomKolPaste(sample);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.twitterHandle, 'vibed333');
    assert.equal(rows[1]!.displayName, 'Gh0stee');
  });

  it('resolves Gh0stee partial against known pool', () => {
    const result = importAxiomKolPaste(sample, KNOWN);
    assert.equal(result.resolved, 1);
    assert.equal(result.rows[0]!.address, KNOWN[1]);
    assert.equal(result.rows[0]!.twitterHandle, 'gh0stee');
    assert.equal(result.unresolved.length, 1);
  });
});

describe('Kolscan leaderboard paste parser', () => {
  const sample = `1
pfp
Cented
twitter logo
CyaE1V

2347

/
1986

+3,601.69 Sol
($246,103.1)
2
pfp
theo
twitter logo
Bi4rd5

1184

/
1626

+2,808.74 Sol
($191,921.1)`;

  it('parses rank blocks with PnL', () => {
    const parsed = parseKolscanLeaderboardPaste(sample);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0]!.displayName, 'Cented');
    assert.equal(parsed[0]!.rank, 1);
    assert.equal(parsed[0]!.pnlUsd, 246103.1);
  });

  it('resolves leaderboard partials against registry pool', () => {
    const result = importKolscanLeaderboardPaste(sample, KNOWN);
    assert.equal(result.resolved, 2);
    assert.equal(result.rows[0]!.displayName, 'Cented');
    assert.ok(result.rows[0]!.winRate != null);
  });
});

describe('combined kol label paste', () => {
  it('merges axiom twitter onto kolscan stats for same wallet', () => {
    const text = `Gh0stee
@gh0stee
2kv8...Rva9

25
pfp
Kadenox
twitter logo
B32Qbb

370

/
288

+304.90 Sol
($20,833.5)`;

    const result = importKolLabelPaste(text, KNOWN);
    const ghost = result.rows.find((r) => r.displayName === 'Gh0stee');
    assert.ok(ghost);
    assert.equal(ghost!.twitterHandle, 'gh0stee');
    assert.equal(ghost!.address, KNOWN[1]);
  });
});
