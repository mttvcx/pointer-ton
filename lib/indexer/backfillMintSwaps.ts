import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveWalletStatsFromSwaps } from '@/lib/indexer/deriveWalletStats';
import { fetchHeliusAddressTransactions } from '@/lib/indexer/heliusEnhanced';
import { parseSwapFromEnhancedTx } from '@/lib/indexer/parseSwapFromEnhancedTx';
import { resolveIndexerTargets } from '@/lib/indexer/resolveIndexerTargets';
import { buildChainTopTradersFromSwaps } from '@/lib/indexer/chainTopTraders';
import type { MintSwapRow } from '@/lib/db/mintSwaps';
import type { BackfillReport, ParsedMintSwap } from '@/lib/indexer/types';
import { resolveTokenSupplyUi } from '@/lib/tokens/supplyUi';
import type { MintIndexStatusState, MintIndexStatusRow } from '@/lib/db/mintIndexStatus';

type UpsertIndexPatch = Partial<
  Omit<MintIndexStatusRow, 'mint' | 'updated_at'>
> & { mint: string };

async function upsertMintIndexStatusLocal(
  supabase: SupabaseClient,
  patch: UpsertIndexPatch,
): Promise<MintIndexStatusRow | null> {
  const now = new Date().toISOString();
  const payload = { ...patch, updated_at: now } as MintIndexStatusRow;
  const { data, error } = await supabase
    .from('mint_index_status')
    .upsert(payload, { onConflict: 'mint' })
    .select('*')
    .maybeSingle();
  if (error) {
    if (error.message?.includes('does not exist')) return null;
    throw new Error(`upsertMintIndexStatus failed: ${error.message}`);
  }
  return (data as MintIndexStatusRow | null) ?? null;
}

type _MintIndexStatusState = MintIndexStatusState; // re-export type for callers

const WSOL = 'So11111111111111111111111111111111111111112';

type InsertMintSwapResult = 'inserted' | 'duplicate' | 'error';

async function insertSwap(
  supabase: SupabaseClient,
  swap: ParsedMintSwap,
): Promise<InsertMintSwapResult> {
  const row = {
    mint: swap.mint,
    signature: swap.signature,
    wallet: swap.wallet,
    event_kind: swap.eventKind,
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
  };

  let { error } = await supabase.from('mint_swaps').insert(row);
  if (error?.message?.includes('event_kind')) {
    const { event_kind: _drop, ...legacy } = row;
    ({ error } = await supabase.from('mint_swaps').insert(legacy));
  }

  if (!error) return 'inserted';
  if (error.code === '23505') return 'duplicate';
  return 'error';
}

async function listSwapsAsc(
  supabase: SupabaseClient,
  mint: string,
): Promise<MintSwapRow[]> {
  const { data, error } = await supabase
    .from('mint_swaps')
    .select('*')
    .eq('mint', mint)
    .order('block_time', { ascending: true })
    .limit(20_000);
  if (error) throw new Error(`listMintSwapsAsc failed: ${error.message}`);
  return (data ?? []) as MintSwapRow[];
}

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

export type GeneralBackfillOptions = {
  mint: string;
  maxPagesPerTarget?: number;
  pageSize?: number;
  dryRun?: boolean;
  /** When true, also upsert the mint_index_status row. Defaults to true. */
  recordStatus?: boolean;
};

export type GeneralBackfillReport = BackfillReport & {
  status: MintIndexStatusRow | null;
};

async function ensureTokenExists(supabase: SupabaseClient, mint: string): Promise<void> {
  const { data } = await supabase.from('tokens').select('mint').eq('mint', mint).maybeSingle();
  if (data?.mint) return;
  const { error } = await supabase
    .from('tokens')
    .upsert({
      mint,
      symbol: null,
      name: null,
      decimals: 6,
      last_seen_at: new Date().toISOString(),
    });
  if (error) throw new Error(`ensureTokenExists failed: ${error.message}`);
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

export async function backfillMintSwaps(
  supabase: SupabaseClient,
  opts: GeneralBackfillOptions,
): Promise<GeneralBackfillReport> {
  const mint = opts.mint.trim();
  if (!mint) throw new Error('backfillMintSwaps: empty mint');

  const dryRun = opts.dryRun ?? false;
  const recordStatus = opts.recordStatus ?? true;
  const maxPages = Math.min(50, Math.max(1, opts.maxPagesPerTarget ?? 6));
  const pageSize = Math.min(100, Math.max(10, opts.pageSize ?? 100));

  const { targets, primary } = await resolveIndexerTargets(mint);
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

  if (recordStatus && !dryRun) {
    await upsertMintIndexStatusLocal(supabase, {
      mint,
      status: 'indexing',
      last_started_at: new Date().toISOString(),
    } as UpsertIndexPatch).catch(() => null);
  }

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

        try {
          const result = await insertSwap(supabase, parsed.swap);
          if (result === 'inserted') swapsInserted += 1;
          else if (result === 'duplicate') swapsSkippedDuplicate += 1;
        } catch (err) {
          parserFailures += 1;
          if (failureSamples.length < 12) {
            failureSamples.push(`${sig.slice(0, 12)}…:insert_failed`);
          }
        }
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

  let status: MintIndexStatusRow | null = null;
  if (recordStatus && !dryRun) {
    status = await upsertMintIndexStatusLocal(supabase, {
      mint,
      status: swapsInserted > 0 ? 'indexed' : 'no_swaps',
      last_indexed_at: new Date().toISOString(),
      swap_count: swapsInserted,
      signature_count: signaturesFetched,
      wallet_count: walletsDerived,
      top_trader_count: topTraderCount,
      primary_pool: primary?.address ?? null,
      last_error: null,
    } as UpsertIndexPatch).catch(() => null);
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
    status,
  };
}

/** Quick status read for a single mint — uses the mint_index_status table. */
export async function getMintIndexStatus(
  supabase: SupabaseClient,
  mint: string,
): Promise<MintIndexStatusRow | null> {
  const { data, error } = await supabase
    .from('mint_index_status')
    .select('*')
    .eq('mint', mint)
    .maybeSingle();
  if (error) {
    if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
      return null;
    }
    return null;
  }
  return (data as MintIndexStatusRow | null) ?? null;
}
