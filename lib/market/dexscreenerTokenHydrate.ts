import 'server-only';

import type { AppChainId } from '@/lib/chains/appChain';
import { evmAddressesMatch } from '@/lib/chains/evmAddress';
import { inferMintKind } from '@/lib/chains/mintKind';
import { classificationUpdateFromLaunchEvent, enrichTokenInsertFromLaunchEvent } from '@/lib/protocol/enrichTokenRow';
import type { LaunchpadEvent } from '@/lib/helius/parsers';
import { getTokenByMint, insertMarketSnapshot, updateToken, upsertToken, type TokenRow } from '@/lib/db/tokens';
import { LAUNCHPAD_LABELS, type LaunchpadId } from '@/lib/utils/constants';
import type { Json } from '@/lib/supabase/types';
import { guardProvider } from '@/lib/providers/circuitBreaker';
import {
  fetchDexMetricsForMints,
  type DexPairRow,
} from '@/lib/market/dexscreenerPulse';
import { hydratePumpFunTokenRow, tokenNeedsPumpFunHydrate } from '@/lib/market/hydratePumpFunTokenRow';
import { protocolBrandIdFromDexId } from '@/lib/protocol/dexProtocolMap';

const CHAIN_PATH: Partial<Record<AppChainId, string>> = {
  sol: 'solana',
  eth: 'ethereum',
  bnb: 'bsc',
  base: 'base',
};

type DexLatestResponse = {
  pairs?: DexPairRow[];
};

function pickBestPair(pairs: DexPairRow[]): DexPairRow | null {
  if (pairs.length === 0) return null;
  return [...pairs].sort((a, b) => {
    const la = Number(a.liquidity?.usd) || 0;
    const lb = Number(b.liquidity?.usd) || 0;
    if (lb !== la) return lb - la;
    return (Number(b.volume?.h24) || 0) - (Number(a.volume?.h24) || 0);
  })[0]!;
}

/**
 * Hydrate a token row from DexScreener when Helius DAS is unavailable or the mint is not indexed yet.
 * Does not revalidate Pulse or emit new-token alerts (safe during `/token/[mint]` render).
 */
export async function ensureTokenRowFromDexScreener(
  mint: string,
  chain: AppChainId = 'sol',
): Promise<TokenRow | null> {
  const chainPath = CHAIN_PATH[chain];
  if (!chainPath) return null;

  let existing = await getTokenByMint(mint);
  if (existing && tokenNeedsPumpFunHydrate(existing, mint)) {
    existing = await hydratePumpFunTokenRow(mint, existing);
  }
  if (
    existing?.name?.trim() &&
    existing?.symbol?.trim() &&
    existing?.image_url?.trim()
  ) {
    return existing;
  }

  let pairs: DexPairRow[] = [];
  try {
    // Circuit breaker (rate-limit protection). Throws when tripped/disabled —
    // the catch below degrades to whatever token data we already have.
    await guardProvider('dexscreener', 1);
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`,
      { cache: 'no-store', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6_000) },
    );
    if (res.ok) {
      const json = (await res.json()) as DexLatestResponse;
      pairs = json.pairs ?? [];
    }
  } catch {
    /* best-effort */
  }

  const best = pickBestPair(
    pairs.filter((p) => {
      const base = p.baseToken?.address?.trim();
      if (!base) return false;
      return inferMintKind(mint) === 'evm' ? evmAddressesMatch(base, mint) : base === mint;
    }),
  );
  let saved: TokenRow | null =
    existing?.name?.trim() && existing?.symbol?.trim() && existing?.image_url?.trim()
      ? existing
      : null;
  if (best?.baseToken) {
    const symbol = best.baseToken.symbol?.trim() || null;
    const name = best.baseToken.name?.trim() || null;
    const image_url =
      best.info?.imageUrl?.trim() ||
      `https://dd.dexscreener.com/ds-data/tokens/${chainPath}/${mint}.png`;

    const raw = {
      dexscreenerHydrate: true,
      dexId: best.dexId ?? null,
      pairAddress: best.pairAddress ?? null,
    } as unknown as Json;

    const dexLaunch =
      best.dexId != null ? protocolBrandIdFromDexId(best.dexId, chain) : null;
    // `protocolBrandIdFromDexId` returns the full ProtocolBrandId union (incl.
    // ton/raydium/orca/meteora/…); LaunchpadEvent.launchpad is the narrower
    // LaunchpadId. Coerce anything that isn't a real LaunchpadId to 'unknown'.
    const launchpad: LaunchpadId =
      best.dexId === 'pumpfun'
        ? 'pump.fun'
        : dexLaunch != null && dexLaunch in LAUNCHPAD_LABELS
          ? (dexLaunch as LaunchpadId)
          : 'unknown';

    const ev: LaunchpadEvent = {
      launchpad,
      mint,
      creator_wallet: null,
      symbol,
      name,
      image_url,
      initial_liquidity_sol: null,
      bonding_progress: null,
      raw,
    };

    const now = new Date().toISOString();
    if (existing) {
      const classPatch = classificationUpdateFromLaunchEvent(ev, existing, 'dexscreener_hydrate');
      saved = await updateToken(mint, {
        last_seen_at: now,
        symbol: symbol ?? existing.symbol,
        name: name ?? existing.name,
        image_url: image_url ?? existing.image_url,
        raw_metadata: raw,
        ...(classPatch ?? {}),
      });
    } else {
      const base = {
        mint: ev.mint,
        symbol: ev.symbol,
        name: ev.name,
        decimals: 6,
        image_url: ev.image_url,
        creator_wallet: null,
        launch_pad: ev.launchpad === 'unknown' ? null : ev.launchpad,
        raw_metadata: raw,
        created_at: now,
        last_seen_at: now,
      };
      saved = await upsertToken(enrichTokenInsertFromLaunchEvent(base, ev, 'dexscreener_hydrate'));
    }
  }

  const metrics = await fetchDexMetricsForMints(chainPath, [mint]);
  const snap = metrics.get(mint);
  if (snap) {
    try {
      await insertMarketSnapshot(snap);
    } catch {
      /* snapshot optional */
    }
  }

  const row = saved ?? (await getTokenByMint(mint));
  return row ? hydratePumpFunTokenRow(mint, row) : null;
}
