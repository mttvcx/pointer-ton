/**
 * Diagnose the most recent pack open's delivery state.
 * Run: node --import tsx scripts/pack-delivery-diag.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';

const url =
  process.env.SUPABASE_SERVICE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim() || '';
const supabase = createClient(url, key, { auth: { persistSession: false } });

const TREASURY = 'cZAaqAgu8QfK3SAfy9axt9tE1mpq6kicKhwQmGTPS8a';
const RPC = 'https://api.mainnet-beta.solana.com';

async function rpc(method: string, params: unknown[]) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  return (await r.json()).result;
}

async function main() {
  console.log('=== latest pack_payments ===');
  const { data: pays } = await supabase
    .from('pack_payments')
    .select('payment_tx, status, open_id, amount_lamports, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(3);
  for (const p of pays ?? []) {
    console.log(`\n  tx ${String(p.payment_tx).slice(0, 12)}…  status=${p.status}  open=${p.open_id ?? '—'}  ${p.created_at}`);
    const meta = p.metadata as { fulfillment?: unknown; reason?: string } | null;
    if (meta?.reason) console.log(`    reason: ${meta.reason}`);
    if (Array.isArray(meta?.fulfillment)) {
      for (const f of meta.fulfillment as Array<Record<string, unknown>>) {
        console.log(
          `    reward ${String(f.mint).slice(0, 6)}… ok=${f.ok} delivered=${f.deliveredRaw ?? '—'} err=${f.error ?? '—'} buy=${String(f.buyTx ?? '').slice(0, 8)} xfer=${String(f.transferTx ?? '').slice(0, 8)}`,
        );
      }
    } else {
      console.log('    (no fulfillment metadata recorded — after() likely killed before marking status)');
    }
  }

  console.log('\n=== latest payment full metadata ===');
  console.log('  ', JSON.stringify(pays?.[0]?.metadata ?? null));

  console.log('\n=== latest pack_opens (rolled rewards) ===');
  const { data: opens } = await supabase
    .from('pack_opens')
    .select('open_id, pack_type, price_sol, total_token_value_sol, house_edge_bps, simulated, result, created_at')
    .order('created_at', { ascending: false })
    .limit(2);
  for (const o of opens ?? []) {
    console.log(`\n  open ${String(o.open_id).slice(0, 8)} ${o.pack_type} price=${o.price_sol} edgeBps=${o.house_edge_bps} sim=${o.simulated} tokenVal=${o.total_token_value_sol}`);
    const result = o.result as { rewards?: Array<Record<string, unknown>> } | null;
    for (const r of result?.rewards ?? []) {
      console.log(`    reward kind=${r.kind} sym=${r.tokenSymbol ?? '—'} mint=${String(r.tokenMint ?? '').slice(0, 6)} valSol=${r.valueSol ?? '—'}`);
    }
  }

  console.log('\n=== latest pack_inventory ===');
  const { data: inv } = await supabase
    .from('pack_inventory')
    .select('mint, amount_raw, open_id, acquired_tx, status, created_at')
    .order('created_at', { ascending: false })
    .limit(8);
  for (const i of inv ?? []) {
    console.log(`  ${String(i.mint).slice(0, 8)}… amt=${i.amount_raw} open=${String(i.open_id ?? '').slice(0, 8)} status=${i.status} tx=${String(i.acquired_tx ?? '').slice(0, 8)}`);
  }

  console.log('\n=== treasury on-chain token holdings (bought-but-not-transferred shows here) ===');
  const accts = await rpc('getTokenAccountsByOwner', [
    TREASURY,
    { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
    { encoding: 'jsonParsed' },
  ]);
  const list = accts?.value ?? [];
  if (list.length === 0) console.log('  (none — treasury holds 0 tokens)');
  for (const a of list) {
    const info = a.account?.data?.parsed?.info;
    const amt = info?.tokenAmount?.uiAmountString ?? info?.tokenAmount?.amount;
    console.log(`  mint ${String(info?.mint).slice(0, 8)}…  amount=${amt}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
