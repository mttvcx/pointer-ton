#!/usr/bin/env node
// Reseed the CabalSpy wallet-label directory (Solana + EVM) from the live API.
//
// Usage:  node scripts/reseed-cabalspy.mjs
// Reads CABALSPY_API_KEY from the env or .env.local. Rewrites:
//   data/identity/cabalspy-sol-seed.json   (kol + smart + whale)
//   data/identity/cabalspy-evm-seed.json    (base + bnb + eth, kol + smart)
// Then `git diff` / commit the regenerated seeds and redeploy.
//
// NOTE: SolScanner is session-walled with no public API — it can't be reseeded
// headlessly. Refresh it via the logged-in browser (parse the RSC
// `self.__next_f` payload on /kol → {wallet_address,name,twitter_handle}) and
// regenerate data/identity/solscanner-kol-sol-seed.json by hand.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const BASE = 'https://api.cabalspy.xyz';

function apiKey() {
  if (process.env.CABALSPY_API_KEY) return process.env.CABALSPY_API_KEY;
  if (existsSync('.env.local')) {
    const m = readFileSync('.env.local', 'utf8').match(/^CABALSPY_API_KEY="?([^"\n]+)/m);
    if (m) return m[1];
  }
  throw new Error('CABALSPY_API_KEY not found in env or .env.local');
}

const handle = (tw) => {
  if (!tw) return null;
  const h = String(tw).replace(/^https?:\/\/(x|twitter)\.com\//i, '').replace(/^@/, '').split(/[/?]/)[0];
  return h || null;
};

async function fetchList(key, blockchain, type) {
  const res = await fetch(`${BASE}/v1/wallets?blockchain=${blockchain}&type=${type}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`CabalSpy ${blockchain}/${type} -> ${res.status}`);
  const json = await res.json();
  return json?.data?.wallets ?? [];
}

function toRow(w, seedChain, category, confidence) {
  const address = String(w.wallet_address || '').trim();
  const name = String(w.name || '').trim();
  if (!address || !name) return null;
  const row = { chain: seedChain, address, displayName: name.slice(0, 60), source: 'cabalspy', category, confidence };
  const tw = handle(w.twitter);
  if (tw) row.twitterHandle = tw;
  if (w.image_url) row.avatarUrl = w.image_url;
  const tg = String(w.telegram || '').replace(/^@/, '').trim();
  if (tg) row.telegramHandle = tg;
  return row;
}

function build(lists) {
  const seen = new Set();
  const rows = [];
  for (const { wallets, seedChain, category, confidence } of lists) {
    for (const w of wallets) {
      const row = toRow(w, seedChain, category, confidence);
      if (!row) continue;
      const k = `${seedChain}:${row.address.toLowerCase()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      rows.push(row);
    }
  }
  return rows;
}

async function main() {
  const key = apiKey();

  // Solana
  const [solKol, solSmart, solWhale] = await Promise.all([
    fetchList(key, 'solana', 'kol'),
    fetchList(key, 'solana', 'smart'),
    fetchList(key, 'solana', 'whale'),
  ]);
  const sol = build([
    { wallets: solKol, seedChain: 'solana', category: 'kol', confidence: 0.9 },
    { wallets: solSmart, seedChain: 'solana', category: 'smart_money', confidence: 0.9 },
    { wallets: solWhale, seedChain: 'solana', category: 'whale', confidence: 0.9 },
  ]);
  writeFileSync('data/identity/cabalspy-sol-seed.json', JSON.stringify(sol));

  // EVM (base/bnb/eth)
  const [baseKol, baseSmart, bnbKol, bnbSmart, ethKol] = await Promise.all([
    fetchList(key, 'base', 'kol'),
    fetchList(key, 'base', 'smart'),
    fetchList(key, 'bnb', 'kol'),
    fetchList(key, 'bnb', 'smart'),
    fetchList(key, 'eth', 'kol'),
  ]);
  const evm = build([
    { wallets: baseKol, seedChain: 'base', category: 'kol', confidence: 0.9 },
    { wallets: baseSmart, seedChain: 'base', category: 'smart_money', confidence: 0.9 },
    { wallets: bnbKol, seedChain: 'bsc', category: 'kol', confidence: 0.9 },
    { wallets: bnbSmart, seedChain: 'bsc', category: 'smart_money', confidence: 0.9 },
    { wallets: ethKol, seedChain: 'ethereum', category: 'kol', confidence: 0.9 },
  ]);
  writeFileSync('data/identity/cabalspy-evm-seed.json', JSON.stringify(evm));

  console.log(`reseeded CabalSpy: ${sol.length} Solana + ${evm.length} EVM wallets`);
  console.log('Review `git diff data/identity/`, commit, and redeploy.');
}

main().catch((e) => {
  console.error('[reseed-cabalspy] failed:', e.message);
  process.exit(1);
});
