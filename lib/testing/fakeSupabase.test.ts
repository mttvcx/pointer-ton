import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FakeSupabase, type Row } from '@/lib/testing/fakeSupabase';

describe('fakeSupabase — query subset', () => {
  it('insert + select with eq', async () => {
    const db = new FakeSupabase();
    await db.from('t').insert({ user_id: 'u1', v: 1 });
    await db.from('t').insert({ user_id: 'u2', v: 2 });
    const { data } = await db.from('t').select('*').eq('user_id', 'u1');
    assert.equal((data as Row[]).length, 1);
    assert.equal((data as Row[])[0]!.v, 1);
  });

  it('maybeSingle returns the row or null (no error on empty)', async () => {
    const db = new FakeSupabase();
    await db.from('t').insert({ trade_id: 'x' });
    const hit = await db.from('t').select('id').eq('trade_id', 'x').maybeSingle();
    assert.ok(hit.data);
    const miss = await db.from('t').select('id').eq('trade_id', 'nope').maybeSingle();
    assert.equal(miss.data, null);
    assert.equal(miss.error, null);
  });

  it('contains matches a jsonb subset; filter(->>) reads json keys', async () => {
    const db = new FakeSupabase();
    await db.from('t').insert({ metadata: { trade_id: 'abc', n: 1 } });
    const c = await db.from('t').select('id').contains('metadata', { trade_id: 'abc' }).limit(1);
    assert.equal((c.data as Row[]).length, 1);
    const f = await db.from('t').select('id').filter('metadata->>trade_id', 'eq', 'abc').maybeSingle();
    assert.ok(f.data);
  });

  it('head count', async () => {
    const db = new FakeSupabase();
    await db.from('t').insert([{ a: 1 }, { a: 1 }, { a: 2 }]);
    const { count } = await db.from('t').select('*', { count: 'exact', head: true }).eq('a', 1);
    assert.equal(count, 2);
  });
});

describe('fakeSupabase — UNIQUE constraint (exactly-once)', () => {
  it('a second insert with the same unique key fails with SQLSTATE 23505', async () => {
    const db = new FakeSupabase().addUnique('referral_earnings', (r) =>
      r.trade_id != null ? String(r.trade_id) : null,
    );
    const first = await db.from('referral_earnings').insert({ trade_id: 't1', amt: 5 });
    assert.equal(first.error, null);
    const second = await db.from('referral_earnings').insert({ trade_id: 't1', amt: 5 });
    assert.equal(second.error?.code, '23505');
    assert.equal(db.rowCount('referral_earnings'), 1); // exactly one
  });

  it('a null unique signature is exempt (partial-index predicate not met)', async () => {
    const db = new FakeSupabase().addUnique('t', (r) => (r.trade_id != null ? String(r.trade_id) : null));
    await db.from('t').insert({ trade_id: null });
    await db.from('t').insert({ trade_id: null }); // both allowed (exempt)
    assert.equal(db.rowCount('t'), 2);
  });

  it('composite unique key (user+event+dedupe)', async () => {
    const db = new FakeSupabase().addUnique('points_events', (r) => {
      const dk = (r.metadata as Row | undefined)?.dedupe_key;
      return dk != null ? `${r.user_id}|${r.event_type}|${dk}` : null;
    });
    await db.from('points_events').insert({ user_id: 'u', event_type: 'login', metadata: { dedupe_key: 'd1' } });
    const dup = await db.from('points_events').insert({ user_id: 'u', event_type: 'login', metadata: { dedupe_key: 'd1' } });
    assert.equal(dup.error?.code, '23505');
    const ok = await db.from('points_events').insert({ user_id: 'u', event_type: 'login', metadata: { dedupe_key: 'd2' } });
    assert.equal(ok.error, null);
    assert.equal(db.rowCount('points_events'), 2);
  });

  it('upsert swallows a conflict (no error, no duplicate)', async () => {
    const db = new FakeSupabase().addUnique('users', (r) => String(r.privy_id));
    await db.from('users').upsert({ privy_id: 'p1', email: 'a' }, { onConflict: 'privy_id' });
    const again = await db.from('users').upsert({ privy_id: 'p1', email: 'b' }, { onConflict: 'privy_id' });
    assert.equal(again.error, null);
    assert.equal(db.rowCount('users'), 1);
  });
});
