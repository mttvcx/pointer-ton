import 'server-only';

import { emitGlobalPulseNewTokenAlert } from '@/lib/alerts/generate';
import type { PulseNewTokenAlertInput } from '@/lib/alerts/pulseNewTokenTypes';
import { getTokenByMint, updateToken, upsertToken } from '@/lib/db/tokens';
import type { LaunchpadEvent } from '@/lib/helius/parsers';
import type { Json, TablesInsert } from '@/lib/supabase/types';

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
  const existing = await getTokenByMint(ev.mint);
  const now = new Date().toISOString();
  if (existing) {
    await updateToken(ev.mint, {
      last_seen_at: now,
      raw_metadata: ev.raw,
      symbol: ev.symbol ?? existing.symbol,
      name: ev.name ?? existing.name,
      image_url: ev.image_url ?? existing.image_url,
      creator_wallet: ev.creator_wallet ?? existing.creator_wallet,
    });
    return 0;
  }
  await upsertToken(launchEventToTokenInsert(ev));
  await emitGlobalPulseNewTokenAlert({
    mint: ev.mint,
    symbol: ev.symbol,
    name: ev.name,
    launchpad: ev.launchpad === 'unknown' ? null : ev.launchpad,
    source: opts.alertSource,
    creator_wallet: ev.creator_wallet,
    tx_signature: opts.txSignature ?? undefined,
    initial_liquidity_sol: ev.initial_liquidity_sol,
  });
  return 1;
}
