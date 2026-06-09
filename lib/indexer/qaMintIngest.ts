import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveWalletStatsFromSwaps } from '@/lib/indexer/deriveWalletStats';
import { buildChainTopTradersFromSwaps } from '@/lib/indexer/chainTopTraders';
import {
  fetchHeliusAddressTransactions,
  type HeliusEnhancedTx,
} from '@/lib/indexer/heliusEnhanced';
import { parseSwapFromEnhancedTx } from '@/lib/indexer/parseSwapFromEnhancedTx';
import { resolveQaMintIndexerTargets } from '@/lib/indexer/resolveQaMintAddresses';
import type { MintSwapRow } from '@/lib/db/mintSwaps';
import type { ParsedMintSwap } from '@/lib/indexer/types';
import {
  DEFAULT_POINTER_QA_MINT,
  getPointerQaMintClient,
  isPointerQaMintClient,
} from '@/lib/qa/pointerQaMintClient';

const WSOL = 'So11111111111111111111111111111111111111112';

export type QaIngestReport = {
  mint: string;
  transactionsSeen: number;
  swapsParsed: number;
  swapsInserted: number;
  swapsSkippedDuplicate: number;
  parserFailures: number;
  failureSamples: string[];
};

export type QaIndexerSnapshot = {
  mint: string;
  swapCount: number;
  walletStatsCount: number;
  latestSwap: {
    blockTime: string;
    side: string;
    wallet: string;
    signature: string;
  } | null;
  topTraderCount: number;
  parserFailureCount: number | null;
};

export type QaMintIngestContext = {
  mint: string;
  poolHint: string | null;
  decimals: number;
  solUsd: number | null;
  supplyTokens: number | null;
};

export function qaIndexerEnabled(): boolean {
  const flag = process.env.POINTER_QA_INDEXER?.trim();
  if (flag === '0' || flag === 'false') return false;
  return true;
}

export function emptyQaIngestReport(mint: string): QaIngestReport {
  return {
    mint,
    transactionsSeen: 0,
    swapsParsed: 0,
    swapsInserted: 0,
    swapsSkippedDuplicate: 0,
    parserFailures: 0,
    failureSamples: [],
  };
}

/** Coerce a Helius enhanced webhook / REST tx object into our parser shape. */
export function coerceHeliusEnhancedTx(raw: unknown): HeliusEnhancedTx | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const signature = typeof o.signature === 'string' ? o.signature : undefined;
  const timestamp =
    typeof o.timestamp === 'number'
      ? o.timestamp
      : typeof o.blockTime === 'number'
        ? o.blockTime
        : undefined;
  return {
    signature,
    timestamp,
    slot: typeof o.slot === 'number' ? o.slot : undefined,
    feePayer: typeof o.feePayer === 'string' ? o.feePayer : undefined,
    type: typeof o.type === 'string' ? o.type : undefined,
    source: typeof o.source === 'string' ? o.source : undefined,
    tokenTransfers: Array.isArray(o.tokenTransfers)
      ? (o.tokenTransfers as HeliusEnhancedTx['tokenTransfers'])
      : undefined,
    nativeTransfers: Array.isArray(o.nativeTransfers)
      ? (o.nativeTransfers as HeliusEnhancedTx['nativeTransfers'])
      : undefined,
    accountData: Array.isArray(o.accountData)
      ? (o.accountData as HeliusEnhancedTx['accountData'])
      : undefined,
  };
}

/** True when the tx includes a token transfer for the QA mint. */
export function txTouchesQaMint(tx: HeliusEnhancedTx, mint: string): boolean {
  return (tx.tokenTransfers ?? []).some((t) => t.mint === mint && (t.tokenAmount ?? 0) > 0);
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

export async function loadQaMintIngestContext(
  supabase: SupabaseClient,
  mint?: string,
): Promise<QaMintIngestContext> {
  const qaMint = mint?.trim() || getPointerQaMintClient();
  if (!isPointerQaMintClient(qaMint)) {
    throw new Error(`loadQaMintIngestContext: refusing non-QA mint ${qaMint}`);
  }

  const { primary } = await resolveQaMintIndexerTargets(qaMint);

  const { data: token } = await supabase.from('tokens').select('*').eq('mint', qaMint).maybeSingle();
  const { data: snap } = await supabase
    .from('token_market_snapshots')
    .select('*')
    .eq('mint', qaMint)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const decimals = token?.decimals ?? 6;
  const solUsd = await fetchSolUsdSpot();
  const supplyRaw = token?.raw_metadata as { supply?: number } | null;
  const supplyTokens =
    typeof supplyRaw?.supply === 'number'
      ? supplyRaw.supply / 10 ** decimals
      : snap?.market_cap_usd != null && snap?.price_usd != null && snap.price_usd > 0
        ? snap.market_cap_usd / snap.price_usd
        : null;

  return {
    mint: qaMint,
    poolHint: primary?.address ?? null,
    decimals,
    solUsd,
    supplyTokens,
  };
}

export async function insertQaMintSwap(
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
  throw new Error(`insertQaMintSwap failed: ${error.message}`);
}

async function listSwapsAsc(supabase: SupabaseClient, mint: string): Promise<MintSwapRow[]> {
  const { data, error } = await supabase
    .from('mint_swaps')
    .select('*')
    .eq('mint', mint)
    .order('block_time', { ascending: true })
    .limit(20_000);
  if (error) throw new Error(`listSwapsAsc failed: ${error.message}`);
  return (data ?? []) as MintSwapRow[];
}

export async function recomputeQaMintWalletStats(
  supabase: SupabaseClient,
  mint?: string,
): Promise<{ walletsDerived: number; topTraderCount: number }> {
  const qaMint = mint?.trim() || getPointerQaMintClient();
  if (!isPointerQaMintClient(qaMint)) {
    throw new Error(`recomputeQaMintWalletStats: refusing non-QA mint ${qaMint}`);
  }

  const { data: token } = await supabase.from('tokens').select('decimals').eq('mint', qaMint).maybeSingle();
  const { data: snap } = await supabase
    .from('token_market_snapshots')
    .select('price_usd')
    .eq('mint', qaMint)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const decimals = token?.decimals ?? 6;
  const allSwaps = await listSwapsAsc(supabase, qaMint);
  const stats = deriveWalletStatsFromSwaps(allSwaps, {
    currentPriceUsd: snap?.price_usd ?? null,
    decimals,
  });

  const now = new Date().toISOString();
  const payload = stats.map((r) => ({ ...r, updated_at: now }));
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

  return {
    walletsDerived: written,
    topTraderCount: buildChainTopTradersFromSwaps(allSwaps, 25).length,
  };
}

export async function ingestQaSwapsFromEnhancedTxs(
  supabase: SupabaseClient,
  txs: unknown[],
  opts?: {
    mint?: string;
    swapSource?: string;
    context?: QaMintIngestContext;
    recomputeStats?: boolean;
  },
): Promise<QaIngestReport> {
  const ctx = opts?.context ?? (await loadQaMintIngestContext(supabase, opts?.mint));
  const report = emptyQaIngestReport(ctx.mint);
  const seenSigs = new Set<string>();

  for (const raw of txs) {
    const tx = coerceHeliusEnhancedTx(raw);
    if (!tx) continue;
    if (!txTouchesQaMint(tx, ctx.mint)) continue;

    report.transactionsSeen += 1;

    const sig = tx.signature?.trim();
    if (sig && seenSigs.has(sig)) continue;
    if (sig) seenSigs.add(sig);

    const parsed = parseSwapFromEnhancedTx({
      tx,
      mint: ctx.mint,
      poolHint: ctx.poolHint,
      solUsd: ctx.solUsd,
      supplyTokens: ctx.supplyTokens,
      decimals: ctx.decimals,
    });

    if (!parsed.ok) {
      report.parserFailures += 1;
      if (report.failureSamples.length < 12 && sig) {
        report.failureSamples.push(`${sig.slice(0, 12)}…:${parsed.reason}`);
      }
      continue;
    }

    report.swapsParsed += 1;
    const swap: ParsedMintSwap = {
      ...parsed.swap,
      source: opts?.swapSource ?? parsed.swap.source,
    };

    const result = await insertQaMintSwap(supabase, swap);
    if (result === 'inserted') report.swapsInserted += 1;
    else if (result === 'duplicate') report.swapsSkippedDuplicate += 1;
  }

  if (opts?.recomputeStats !== false && report.swapsInserted > 0) {
    await recomputeQaMintWalletStats(supabase, ctx.mint);
  }

  return report;
}

export type ReplayQaMintReport = QaIngestReport & {
  heliusCalls: number;
  creditsEstimated: number;
  walletsDerived: number;
  topTraderCount: number;
};

/** Fetch latest pool txs and upsert QA mint swaps (local replay / incremental ingest). */
export async function replayLatestQaMintSwaps(
  supabase: SupabaseClient,
  opts?: {
    mint?: string;
    limit?: number;
    pages?: number;
    recomputeStats?: boolean;
  },
): Promise<ReplayQaMintReport> {
  const qaMint = opts?.mint?.trim() || getPointerQaMintClient();
  if (!isPointerQaMintClient(qaMint)) {
    throw new Error(`replayLatestQaMintSwaps: refusing non-QA mint ${qaMint}`);
  }

  const limit = Math.min(100, Math.max(1, opts?.limit ?? 50));
  const pages = Math.min(5, Math.max(1, opts?.pages ?? 1));
  const { primary } = await resolveQaMintIndexerTargets(qaMint);
  if (!primary) throw new Error('replayLatestQaMintSwaps: no indexer target resolved');

  const ctx = await loadQaMintIngestContext(supabase, qaMint);
  const report = emptyQaIngestReport(qaMint);
  let heliusCalls = 0;
  let creditsEstimated = 0;

  let before: string | undefined;
  for (let page = 0; page < pages; page++) {
    const { txs, calls, credits } = await fetchHeliusAddressTransactions(primary.address, {
      before,
      limit,
    });
    heliusCalls += calls;
    creditsEstimated += credits;
    if (txs.length === 0) break;

    before = txs[txs.length - 1]?.signature;
    const batch = await ingestQaSwapsFromEnhancedTxs(supabase, txs, {
      context: ctx,
      swapSource: 'helius_replay',
      recomputeStats: false,
    });

    report.transactionsSeen += batch.transactionsSeen;
    report.swapsParsed += batch.swapsParsed;
    report.swapsInserted += batch.swapsInserted;
    report.swapsSkippedDuplicate += batch.swapsSkippedDuplicate;
    report.parserFailures += batch.parserFailures;
    report.failureSamples.push(...batch.failureSamples.slice(0, 12 - report.failureSamples.length));

    if (txs.length < limit) break;
  }

  let walletsDerived = 0;
  let topTraderCount = 0;
  if (opts?.recomputeStats !== false && report.swapsInserted > 0) {
    const stats = await recomputeQaMintWalletStats(supabase, qaMint);
    walletsDerived = stats.walletsDerived;
    topTraderCount = stats.topTraderCount;
  }

  return {
    ...report,
    heliusCalls,
    creditsEstimated,
    walletsDerived,
    topTraderCount,
  };
}

export async function fetchQaIndexerSnapshot(
  supabase: SupabaseClient,
  mint?: string,
): Promise<QaIndexerSnapshot> {
  const qa = mint?.trim() || DEFAULT_POINTER_QA_MINT;

  const [{ count: swapCount }, { count: walletStatsCount }] = await Promise.all([
    supabase.from('mint_swaps').select('id', { count: 'exact', head: true }).eq('mint', qa),
    supabase
      .from('mint_wallet_stats')
      .select('wallet', { count: 'exact', head: true })
      .eq('mint', qa),
  ]);

  const { data: latest } = await supabase
    .from('mint_swaps')
    .select('block_time, side, wallet, signature')
    .eq('mint', qa)
    .order('block_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  const allSwaps = await listSwapsAsc(supabase, qa);
  const topTraderCount = buildChainTopTradersFromSwaps(allSwaps, 25).length;

  return {
    mint: qa,
    swapCount: swapCount ?? 0,
    walletStatsCount: walletStatsCount ?? 0,
    latestSwap: latest
      ? {
          blockTime: latest.block_time as string,
          side: latest.side as string,
          wallet: latest.wallet as string,
          signature: latest.signature as string,
        }
      : null,
    topTraderCount,
    parserFailureCount: null,
  };
}
