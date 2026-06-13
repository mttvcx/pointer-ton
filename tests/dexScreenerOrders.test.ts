import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchDexScreenerPaidFlag, fetchDexScreenerOrdersForToken } from '@/lib/dex/dexScreenerOrders';

test('fetchDexScreenerOrdersForToken returns null on network error', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('offline');
  }) as typeof fetch;
  try {
    const result = await fetchDexScreenerOrdersForToken('So11111111111111111111111111111111111111112');
    assert.equal(result, null);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('fetchDexScreenerPaidFlag returns null on non-2xx', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('nope', { status: 500 })) as typeof fetch;
  try {
    const result = await fetchDexScreenerPaidFlag('So11111111111111111111111111111111111111112');
    assert.equal(result, null);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('fetchDexScreenerPaidFlag returns false when orders array is empty', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('[]', { status: 200 })) as typeof fetch;
  try {
    const result = await fetchDexScreenerPaidFlag('So11111111111111111111111111111111111111112');
    assert.equal(result, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('fetchDexScreenerPaidFlag returns true when an approved tokenProfile order exists', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify([
        { type: 'tokenProfile', status: 'approved', paymentTimestamp: 1700000000000 },
      ]),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )) as typeof fetch;
  try {
    const result = await fetchDexScreenerPaidFlag('So11111111111111111111111111111111111111112');
    assert.equal(result, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('fetchDexScreenerPaidFlag returns false when all orders are cancelled/rejected', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify([
        { type: 'tokenProfile', status: 'cancelled', paymentTimestamp: 1700000000000 },
        { type: 'communityTakeover', status: 'rejected', paymentTimestamp: 1700000000000 },
      ]),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )) as typeof fetch;
  try {
    const result = await fetchDexScreenerPaidFlag('So11111111111111111111111111111111111111112');
    assert.equal(result, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('fetchDexScreenerOrdersForToken drops malformed entries', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify([
        { type: 'tokenProfile', status: 'approved', paymentTimestamp: 1700000000000 },
        { type: 'mystery', status: 'approved', paymentTimestamp: 1 },
        { type: 'tokenProfile', status: 'wat', paymentTimestamp: 1 },
        'not-an-object',
        null,
      ]),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )) as typeof fetch;
  try {
    const result = await fetchDexScreenerOrdersForToken('So11111111111111111111111111111111111111112');
    assert.ok(result);
    assert.equal(result!.length, 1);
    assert.equal(result![0]!.type, 'tokenProfile');
    assert.equal(result![0]!.status, 'approved');
  } finally {
    globalThis.fetch = realFetch;
  }
});
