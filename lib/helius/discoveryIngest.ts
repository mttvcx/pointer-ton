import 'server-only';

import { emitGlobalPulseNewTokenAlert } from '@/lib/alerts/generate';
import type { PulseNewTokenAlertInput } from '@/lib/alerts/pulseNewTokenTypes';
import { getTokenByMint, updateToken, upsertToken } from '@/lib/db/tokens';
import type { LaunchpadEvent } from '@/lib/helius/parsers';
import type { Json, TablesInsert } from '@/lib/supabase/types';
import { revalidatePulseFeedCache } from '@/lib/server/revalidatePulseFeed';

function inferDecimalsFromRaw(raw: Json): number {
  try {
    const o = raw as Record<string, unknown>;
    const direct = o?.decimals;
    if (typeof direct === 'number' && Number.isFinite(direct)) {
      return Math.max(0, Math.min(24, Math.round(direct)));
    }
    const ti = o?.token_info as { decimals?: unknown } | undefined;
    if (typeof ti?.decimals === 'number' && Number.isFinite(ti.decimals)) {
      return Math.max(0, Math.min(24, Math.round(ti.decimals)));
    }
    const g = o?.geckoToken as { attributes?: { decimals?: unknown } } | undefined;
    const gd = g?.attributes?.decimals;
    if (typeof gd === 'number' && Number.isFinite(gd)) {
      return Math.max(0, Math.min(24, Math.round(gd)));
    }
  } catch {
    /* noop */
  }
  return 6;
}

export function launchEventToTokenInsert(ev: Readonly<LaunchpadEvent>): TablesInsert<'tokens'> {
  const now = new Date().toISOString();
  return {
    mint: ev.mint,
    symbol: ev.symbol,
    name: ev.name,
    decimals: inferDecimalsFromRaw(ev.raw),
    image_url: ev.image_url,
    creator_wallet: ev.creator_wallet,
    launch_pad: ev.launchpad === 'unknown' ? null : ev.launchpad,
    raw_metadata: ev.raw,
    bonding_progress: ev.bonding_progress,
    initial_liquidity_sol: ev.initial_liquidity_sol,
    initial_liquidity_at: ev.initial_liquidity_sol != null ? now : null,
    created_at: now,
    last_seen_at: now,
  };
}

/**
 * Persist a launch discovery (DAS, Gecko, webhook). Returns 1 if a new mint row
 * was created, else 0.
 */
export async function ingestLaunchpadDiscovery(
  ev: LaunchpadEvent,
  opts: {
    alertSource: PulseNewTokenAlertInput['source'];
    txSignature?: string | null;
  },
): Promise<number> {
  const rawWithSource: Json =
    ev.raw && typeof ev.raw === 'object' && !Array.isArray(ev.raw)
      ? ({ ...(ev.raw as Record<string, unknown>), pointerIngestSource: opts.alertSource } as Json)
      : ({ pointerIngestSource: opts.alertSource } as Json);
  const enrichedEv: LaunchpadEvent = { ...ev, raw: rawWithSource };
  const existing = await getTokenByMint(enrichedEv.mint);
  const now = new Date().toISOString();
  if (existing) {
    const bonding_progress =
      enrichedEv.bonding_progress != null
        ? Math.max(enrichedEv.bonding_progress, existing.bonding_progress ?? 0)
        : existing.bonding_progress;
    await updateToken(enrichedEv.mint, {
      last_seen_at: now,
      raw_metadata: rawWithSource,
      symbol: enrichedEv.symbol ?? existing.symbol,
      name: enrichedEv.name ?? existing.name,
      image_url: enrichedEv.image_url ?? existing.image_url,
      creator_wallet: enrichedEv.creator_wallet ?? existing.creator_wallet,
      ...(bonding_progress != null ? { bonding_progress } : {}),
    });
    revalidatePulseFeedCache();
    return 0;
  }
  await upsertToken(launchEventToTokenInsert(enrichedEv));
  revalidatePulseFeedCache();
  await emitGlobalPulseNewTokenAlert({
    mint: enrichedEv.mint,
    symbol: enrichedEv.symbol,
    name: enrichedEv.name,
    launchpad: enrichedEv.launchpad === 'unknown' ? null : enrichedEv.launchpad,
    source: opts.alertSource,
    creator_wallet: enrichedEv.creator_wallet,
    tx_signature: opts.txSignature ?? undefined,
    initial_liquidity_sol: enrichedEv.initial_liquidity_sol,
  });
  return 1;
}
