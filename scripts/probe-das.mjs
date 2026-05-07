import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const k=process.env.HELIUS_API_KEY;
if (!k) {
  console.error('HELIUS_API_KEY missing in .env.local');
  process.exit(1);
}

const u = `https://mainnet.helius-rpc.com/?api-key=${k}`;

async function rpc(method, params) {
  const body = { jsonrpc: '2.0', id: 1, method, params };
  const res = await fetch(u, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

const owner =
  process.env.PULSE_DAS_POLL_OWNER_WALLET ?? '86xCnPeV69n6t3DnyGvkKobf9FdN2H9oiVDdaMpo2MMY';

const r1 = await rpc('searchAssets', {
  tokenType: 'fungible',
  limit: 3,
  sortBy: { sortBy: 'created', sortDirection: 'desc' },
});
console.log('\n--- searchAssets (no owner) ---');
console.log('error', r1.error);
console.log('items', r1.result?.items?.length, 'total', r1.result?.total);

const r2 = await rpc('searchAssets', {
  ownerAddress: owner,
  tokenType: 'fungible',
  limit: 3,
  sortBy: { sortBy: 'created', sortDirection: 'desc' },
});
console.log('\n--- searchAssets (with owner + sort created) ---');
console.log('error', r2.error);
console.log('items', r2.result?.items?.length, 'total', r2.result?.total);

const r2b = await rpc('searchAssets', {
  ownerAddress: owner,
  tokenType: 'fungible',
  limit: 5,
});
console.log('\n--- searchAssets (with owner, no sortBy) ---');
console.log('error', r2b.error);
console.log('items', r2b.result?.items?.length, 'total', r2b.result?.total);
const r2c = await rpc('searchAssets', {
  ownerAddress: owner,
  tokenType: 'fungible',
  limit: 5,
  sortBy: { sortBy: 'id', sortDirection: 'desc' },
});
console.log('\n--- searchAssets (with owner + sort id desc) ---');
console.log('error', r2c.error);
console.log('items', r2c.result?.items?.length, 'total', r2c.result?.total);
if (r2c.result?.items?.length) console.log('first id', r2c.result.items[0].id);

/* getAssetsByAuthority on the pump.fun *program* (6EF8...) returns nothing
   useful — that program isn't the metadata authority. The pump.fun metadata
   authority (TSLv...) is what surfaces freshly-minted tokens. */

const r4 = await rpc('getAssetsByAuthority', {
  authorityAddress: 'TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM',
  page: 1,
  limit: 5,
  sortBy: { sortBy: 'created', sortDirection: 'desc' },
});
console.log('\n--- getAssetsByAuthority (pump.fun authority, sort created desc) ---');
console.log('error', r4.error);
console.log('items', r4.result?.items?.length, 'total', r4.result?.total);
if (r4.result?.items?.length) {
  console.log(
    'sample id',
    r4.result.items[0].id,
    'symbol',
    r4.result.items[0].content?.metadata?.symbol,
  );
}
