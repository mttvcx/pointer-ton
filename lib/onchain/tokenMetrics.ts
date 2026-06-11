import 'server-only';

import { getRedis } from '@/lib/redis/client';
import { countProTraders } from '@/lib/onchain/countProTraders';
import {
  getLatestSnapshotForMint,
  getTokenByMint,
  type TokenHolderRow,
  type TokenRow,
} from '@/lib/db/tokens';
import { listMintSwapsForMintAsc } from '@/lib/db/mintSwaps';
import {
  aggregateMintSwapTapeByTf,
  aggregateMintSwapWindowMetrics,
  indexedVolCoverageByTf,
} from '@/lib/indexer/mintSwapWindowMetrics';
import { isPointerQaMint } from '@/lib/qa/pointerQaMint';
import { resolveTokenHolders } from '@/lib/onchain/resolveTokenHolders';
import { fetchCreatorDevHoldingPct } from '@/lib/onchain/creatorDevHolding';
import { dexTapeFromSnapshot } from '@/lib/market/dexTapeFromSnapshot';

import type { TokenExtendedMetrics } from '@/lib/types/tokenExtendedMetrics';

const VOL_WINDOW_MS = 6 * 60 * 60_000;

const CACHE_PREFIX = 'token:extended_metrics:v4:';
const CACHE_TTL_SEC = 60;

async function loadHolders(
  mint: string,
  opts?: { forceLive?: boolean },
): Promise<{
  rows: TokenHolderRow[];
  holderCountTotal: number | null;
  holderRowsLoaded: number;
  top10HolderPct: number | null;
  top10HolderPctRaw: number | null;
  devHoldingPct: number | null;
}> {
  const resolved = await resolveTokenHolders(mint, {
    limit: 20,
    forceLive: opts?.forceLive,
  });
  if (!resolved) {
    return {
      rows: [],
      holderCountTotal: null,
      holderRowsLoaded: 0,
      top10HolderPct: null,
      top10HolderPctRaw: null,
      devHoldingPct: null,
    };
  }
  return {
    rows: resolved.holders,
    holderCountTotal: resolved.holderCountTotal,
    holderRowsLoaded: resolved.holderRowsLoaded,
    top10HolderPct: resolved.top10HolderPctAdjusted ?? resolved.top10HolderPct,
    top10HolderPctRaw: resolved.top10HolderPctRaw,
    devHoldingPct: resolved.devHoldingPct,
  };
}

/**
 * Compute extended token metrics on read. Cached in Redis 60s per mint.
 * Desk vol/buy/sell/net: wired from mint_swaps for QA indexer mints.
 * Insiders / bundlers / LP burned: Phase 2 stubs (null).
 */
export async function getTokenExtendedMetrics(
  mint: string,
): Promise<{ metrics: TokenExtendedMetrics; token: TokenRow | null }> {
  const redis = getRedis();
  const key = `${CACHE_PREFIX}${mint}`;
  const cached = await redis.get<TokenExtendedMetrics>(key);
  if (cached) {
    const token = await getTokenByMint(mint);
    return { metrics: cached, token };
  }

  const [token, snap, holderDesk] = await Promise.all([
    getTokenByMint(mint),
    getLatestSnapshotForMint(mint),
    loadHolders(mint, { forceLive: isPointerQaMint(mint) }),
  ]);

  const holders = holderDesk.rows;

  let devHoldingPct = holderDesk.devHoldingPct;
  if (devHoldingPct == null && token?.creator_wallet?.trim()) {
    devHoldingPct = await fetchCreatorDevHoldingPct(mint, token.creator_wallet);
  }

  let sniperPct = 0;
  for (const h of holders) {
    if (h.is_sniper && h.pct_of_supply != null) sniperPct += h.pct_of_supply;
  }

  const proTraders = await countProTraders(holders);

  let vol6hUsd: number | null = null;
  let buys6h: number | null = null;
  let sells6h: number | null = null;
  let buyVol6hUsd: number | null = null;
  let sellVol6hUsd: number | null = null;
  let netVol6hUsd: number | null = null;
  let tapeByTf: TokenExtendedMetrics['tapeByTf'] = null;
  let indexedVolPartial: TokenExtendedMetrics['indexedVolPartial'] = null;

  if (isPointerQaMint(mint)) {
    try {
      const swaps = await listMintSwapsForMintAsc(mint, 5_000);
      const byTf = aggregateMintSwapTapeByTf(swaps);
      indexedVolPartial = indexedVolCoverageByTf(swaps);
      const w = byTf['6h'] ?? aggregateMintSwapWindowMetrics(swaps, VOL_WINDOW_MS);
      if (w.volUsd > 0 || w.buys > 0 || w.sells > 0) {
        vol6hUsd = w.volUsd;
        buys6h = w.buys;
        sells6h = w.sells;
        buyVol6hUsd = w.buyVolUsd;
        sellVol6hUsd = w.sellVolUsd;
        netVol6hUsd = w.netVolUsd;
        tapeByTf = byTf;
      }
    } catch {
      /* indexer optional */
    }
  }

  const metrics: TokenExtendedMetrics = {
    top10HolderPct:
      holderDesk.top10HolderPct ??
      (snap?.top10_holder_pct != null ? Math.min(100, snap.top10_holder_pct) : null),
    top10HolderPctRaw: holderDesk.top10HolderPctRaw,
    devHoldingPct: devHoldingPct ?? snap?.dev_holding_pct ?? null,
    sniperHolderPct: sniperPct > 0 ? sniperPct : null,
    insidersPct: null,
    bundlersPct: null,
    lpBurnedPct: null,
    holders: holderDesk.holderCountTotal ?? snap?.holder_count ?? null,
    holderRowsLoaded: holderDesk.holderRowsLoaded > 0 ? holderDesk.holderRowsLoaded : null,
    proTraders,
    dexPaid: token?.is_paid ?? null,
    vol6hUsd,
    buys6h,
    sells6h,
    buyVol6hUsd,
    sellVol6hUsd,
    netVol6hUsd,
    tapeByTf,
    dexTapeByTf: dexTapeFromSnapshot(snap),
    indexedVolPartial,
    taxPct: null,
  };

  await redis.set(key, JSON.stringify(metrics), { ex: CACHE_TTL_SEC });
  return { metrics, token };
}
