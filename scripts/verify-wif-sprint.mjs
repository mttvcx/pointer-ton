/**
 * WIF data correctness sprint verification (read-only).
 * Run: node scripts/verify-wif-sprint.mjs
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const WIF = 'CExejcGZSEnk4FBsBQa3nMnU1jjCYsjw4x9d7cJ4pump';

function env(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function normalizeSupply(raw, decimals) {
  if (raw == null || decimals == null) return null;
  const n = Number(raw);
  const d = Number(decimals);
  if (!Number.isFinite(n) || !Number.isFinite(d)) return null;
  return n / 10 ** d;
}

async function fetchPumpCreator() {
  try {
    const res = await fetch(`https://frontend-api-v3.pump.fun/coins/${WIF}`, {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j.creator === 'string' ? j.creator : null;
  } catch {
    return null;
  }
}

async function main() {
  const sb = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [{ count: swapCount }, { data: token }, { data: snap }] = await Promise.all([
    sb.from('mint_swaps').select('id', { count: 'exact', head: true }).eq('mint', WIF),
    sb.from('tokens').select('symbol,creator_wallet,decimals,raw_metadata').eq('mint', WIF).maybeSingle(),
    sb
      .from('token_market_snapshots')
      .select('price_usd,market_cap_usd,liquidity_usd,snapshot_at')
      .eq('mint', WIF)
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const pumpCreator = await fetchPumpCreator();
  const rawMeta = token?.raw_metadata;
  const rawSupply =
    rawMeta && typeof rawMeta === 'object' && rawMeta !== null && 'supply' in rawMeta
      ? rawMeta.supply
      : null;
  const supplyUi = normalizeSupply(rawSupply, token?.decimals ?? 6);

  console.log(JSON.stringify({
    mint_swaps_count: swapCount ?? 0,
    creator_wallet_db: token?.creator_wallet ?? null,
    pump_fun_creator: pumpCreator,
    holder_note: 'call /api/tokens/.../holders for live holder metrics',
    supply_display_ui: supplyUi,
    header_price_usd: snap?.price_usd ?? null,
    header_mc_usd: snap?.market_cap_usd ?? null,
    header_liquidity_usd: snap?.liquidity_usd ?? null,
    snapshot_at: snap?.snapshot_at ?? null,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
