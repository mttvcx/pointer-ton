import '@/lib/testing/stubServerOnly'; // MUST be first — token.ts is server-only
process.env.EXT_TOKEN_SECRET = 'test-ext-secret-at-least-16-chars-long';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mintExtSession,
  verifyExtToken,
  refreshExtSession,
  revokeExtFamily,
  mintConnectCode,
  consumeConnectCode,
} from '@/lib/ext/token';

const EXT = 'abcdefghijklmnop'; // stand-in chrome extension id

describe('ext scoped token — auth bridge', () => {
  it('mint → verify carries the right identity, ext id, and scope', async () => {
    const s = await mintExtSession('user-1', EXT);
    const v = await verifyExtToken(s.token);
    assert.equal(v.userId, 'user-1');
    assert.equal(v.extId, EXT);
    assert.equal(v.fam, s.refresh);
    assert.match(v.scope, /intel\.read/);
    assert.ok(s.exp > Math.floor(Date.now() / 1000));
  });

  it('revoke kills the family — verify rejects INSTANTLY (not on TTL)', async () => {
    const s = await mintExtSession('user-2', EXT);
    await verifyExtToken(s.token); // ok before
    await revokeExtFamily(s.refresh);
    await assert.rejects(() => verifyExtToken(s.token), /revoked/);
  });

  it('refresh issues a new token under the same family; ext-bound; dead after revoke', async () => {
    const s = await mintExtSession('user-3', EXT);
    const r = await refreshExtSession(s.refresh, EXT);
    assert.ok(r?.token);
    assert.equal((await verifyExtToken(r!.token)).userId, 'user-3');
    assert.equal(await refreshExtSession(s.refresh, 'wrong-ext-id-000'), null); // wrong ext
    await revokeExtFamily(s.refresh);
    assert.equal(await refreshExtSession(s.refresh, EXT), null); // revoked
  });

  it('connect code is single-use and exchanges into a working session', async () => {
    const code = await mintConnectCode('user-4', EXT);
    const session = await consumeConnectCode(code, EXT);
    assert.ok(session?.token);
    assert.equal((await verifyExtToken(session!.token)).userId, 'user-4');
    assert.equal(await consumeConnectCode(code, EXT), null); // single-use
  });

  it('connect code is bound to the approving extension id', async () => {
    const code = await mintConnectCode('user-5', EXT);
    assert.equal(await consumeConnectCode(code, 'attacker-ext-000'), null);
  });

  it('a garbage token is rejected', async () => {
    await assert.rejects(() => verifyExtToken('not.a.jwt'));
  });
});
