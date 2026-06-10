import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveWalletStatsFromSwaps } from '@/lib/indexer/deriveWalletStats';
import { fetchHeliusAddressTransactions } from '@/lib/indexer/heliusEnhanced';
import { parseSwapFromEnhancedTx } from '@/lib/indexer/parseSwapFromEnhancedTx';
import { resolveQaMintIndexerTargets } from '@/lib/indexer/resolveQaMintAddresses';
import { buildChainTopTradersFromSwaps } from '@/lib/indexer/chainTopTraders';
import {
  DEFAULT_POINTER_QA_MINT,
  getPointerQaMintClient,
  isPointerQaMintClient,
} from '@/lib/qa/pointerQaMintClient';
import type { BackfillReport, ParsedMintSwap } from '@/lib/indexer/types';
import type { MintSwapRow } from '@/lib/db/mintSwaps';
import { resolveTokenSupplyUi } from '@/lib/tokens/supplyUi';

const WSOL = 'So11111111111111111111111111111111111111112';

async function fetchSolUsdSpot(): Promise<number | null> {
  try {
    const base =
      process.env.JUPITER_PRICE_API_URL?.replace(/\/$/, '') ?? 'https://api.jup.ag/price/v3';
    const res = await fetch(`${base}?ids=${WSOL}`, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, { usdPrice?: number }>;
    const px = json[WSOL]?.usdPrice;
    return px != null && Number.isFinite(px) ? px : null;
  } catch {
    return null;
  }
}

export type BackfillOptions = {
  mint?: string;
  maxPagesPerTarget?: number;
  pageSize?: number;
  dryRun?: boolean;
};

async function ensureTokenExists(supabase: SupabaseClient, mint: string): Promise<void> {
  const { data } = await supabase.from('tokens').select('mint').eq('mint', mint).maybeSingle();
  if (data?.mint) return;
  const { error } = await supabase.from('tokens').upsert({
    mint,
    symbol: mint === 'CExejcGZSEnk4FBsBQa3nMnU1jjCYsjw4x9d7cJ4pump' ? 'WIF' : 'QA',
    name: mint === 'CExejcGZSEnk4FBsBQa3nMnU1jjCYsjw4x9d7cJ4pump' ? 'dogwifhat' : 'QA Token',
    decimals: 6,
    launch_pad: 'pump.fun',
    last_seen_at: new Date().toISOString(),
  });
  if (error) throw new Error(`ensureTokenExists failed: ${error.message}`);
}

async function insertSwap(
  supabase: SupabaseClient,
  swap: ParsedMintSwap,
): Promise<'inserted' | 'duplicate' | 'error'> {
  const { error } = await supabase.from('mint_swaps').insert({
    mint: swap.mint,
    signature: swap.signature,
    wallet: swap.wallet,
    side: swap.side,
    token_amount_raw: swap.tokenAmountRaw,
    token_amount_ui: swap.tokenAmountUi,
    sol_amount: swap.solAmount,
    usd_amount: swap.usdAmount,
    price_usd: swap.priceUsd,
    market_cap_usd: swap.marketCapUsd,
    block_time: swap.blockTime,
    slot: swap.slot,
    program_id: swap.programId,
    pool_address: swap.poolAddress,
    source: swap.source,
  });
  if (!error) return 'inserted';
  if (error.code === '23505') return 'duplicate';
  throw new Error(`insertMintSwap failed: ${error.message}`);
}

async function listSwapsAsc(supabase: SupabaseClient, mint: string): Promise<MintSwapRow[]> {
  const { data, error } = await supabase
    .from('mint_swaps')
    .select('*')
    .eq('mint', mint)
    .order('block_time', { ascending: true })
    .limit(20_000);
  if (error) throw new Error(`listMintSwapsAsc failed: ${error.message}`);
  return (data ?? []) as MintSwapRow[];
}

async function upsertWalletStats(
  supabase: SupabaseClient,
  rows: ReturnType<typeof deriveWalletStatsFromSwaps>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const now = new Date().toISOString();
  const payload = rows.map((r) => ({ ...r, updated_at: now }));
  const chunk = 200;
  let written = 0;
  for (let i = 0; i < payload.length; i += chunk) {
    const slice = payload.slice(i, i + chunk);
    const { error } = await supabase.from('mint_wallet_stats').upsert(slice, {
      onConflict: 'mint,wallet',
    });
    if (error) throw new Error(`upsertMintWalletStats failed: ${error.message}`);
    written += slice.length;
  }
  return written;
}

export async function backfillQaMintSwaps(
  supabase: SupabaseClient,
  opts?: BackfillOptions,
): Promise<BackfillReport> {
  const mint = opts?.mint?.trim() || getPointerQaMintClient();
  if (!isPointerQaMintClient(mint)) {
    throw new Error(`backfillQaMintSwaps: refusing non-QA mint ${mint}`);
  }

  const dryRun = opts?.dryRun ?? false;
  const maxPages = Math.min(50, Math.max(1, opts?.maxPagesPerTarget ?? 10));
  const pageSize = Math.min(100, Math.max(10, opts?.pageSize ?? 100));

  const { targets, primary } = await resolveQaMintIndexerTargets(mint);
  await ensureTokenExists(supabase, mint);

  const { data: token } = await supabase.from('tokens').select('*').eq('mint', mint).maybeSingle();
  const { data: snap } = await supabase
    .from('token_market_snapshots')
    .select('*')
    .eq('mint', mint)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const decimals = token?.decimals ?? 6;

  const solUsd = await fetchSolUsdSpot();

  const supplyTokens = resolveTokenSupplyUi(token?.raw_metadata, decimals, {
    marketCapUsd: snap?.market_cap_usd,
    priceUsd: snap?.price_usd,
  });

  let signaturesFetched = 0;
  let transactionsParsed = 0;
  let swapsParsed = 0;
  let swapsInserted = 0;
  let swapsSkippedDuplicate = 0;
  let parserFailures = 0;
  const failureSamples: string[] = [];
  let heliusCalls = 0;
  let creditsEstimated = 0;

  const seenSigs = new Set<string>();

  for (const target of targets) {
    let before: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      const { txs, calls, credits } = await fetchHeliusAddressTransactions(target.address, {
        before,
        limit: pageSize,
      });
      heliusCalls += calls;
      creditsEstimated += credits;
      if (txs.length === 0) break;

      before = txs[txs.length - 1]?.signature;
      signaturesFetched += txs.length;

      for (const tx of txs) {
        const sig = tx.signature;
        if (!sig || seenSigs.has(sig)) continue;
        seenSigs.add(sig);
        transactionsParsed += 1;

        const parsed = parseSwapFromEnhancedTx({
          tx,
          mint,
          poolHint: target.kind === 'dex_pair' ? target.address : primary?.address ?? null,
          solUsd,
          supplyTokens,
          decimals,
        });

        if (!parsed.ok) {
          parserFailures += 1;
          if (failureSamples.length < 12) {
            failureSamples.push(`${sig.slice(0, 12)}…:${parsed.reason}`);
          }
          continue;
        }

        swapsParsed += 1;
        if (dryRun) continue;

        const result = await insertSwap(supabase, parsed.swap);
        if (result === 'inserted') swapsInserted += 1;
        else if (result === 'duplicate') swapsSkippedDuplicate += 1;
      }

      if (txs.length < pageSize) break;
    }
  }

  let walletsDerived = 0;
  let topTraderCount = 0;

  if (!dryRun) {
    const allSwaps = await listSwapsAsc(supabase, mint);
    const stats = deriveWalletStatsFromSwaps(allSwaps, {
      currentPriceUsd: snap?.price_usd ?? null,
      decimals,
    });
    walletsDerived = await upsertWalletStats(supabase, stats);
    topTraderCount = buildChainTopTradersFromSwaps(allSwaps, 25).length;
  }

  return {
    mint,
    dryRun,
    targets,
    signaturesFetched,
    transactionsParsed,
    swapsParsed,
    swapsInserted,
    swapsSkippedDuplicate,
    parserFailures,
    failureSamples,
    walletsDerived,
    topTraderCount,
    heliusCalls,
    creditsEstimated,
  };
}

export async function qaIndexerStatus(supabase: SupabaseClient, mint?: string) {
  const qa = mint?.trim() || DEFAULT_POINTER_QA_MINT;
  const [{ count: swapCount }, { count: walletCount }] = await Promise.all([
    supabase.from('mint_swaps').select('id', { count: 'exact', head: true }).eq('mint', qa),
    supabase
      .from('mint_wallet_stats')
      .select('wallet', { count: 'exact', head: true })
      .eq('mint', qa),
  ]);
  return { mint: qa, swapCount: swapCount ?? 0, walletCount: walletCount ?? 0 };
}
