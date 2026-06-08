import 'server-only';

import { emitGlobalPulseNewTokenAlert } from '@/lib/alerts/generate';
import type { PulseNewTokenAlertInput } from '@/lib/alerts/pulseNewTokenTypes';
import { getTokenByMint, updateToken, upsertToken } from '@/lib/db/tokens';
import type { LaunchpadEvent } from '@/lib/helius/parsers';
import { extractBondingProgressPct } from '@/lib/tokens/bondingProgress';
import {
  classificationUpdateFromLaunchEvent,
  enrichTokenInsertFromLaunchEvent,
} from '@/lib/protocol/enrichTokenRow';
import type { Json, TablesInsert } from '@/lib/supabase/types';
import { revalidatePulseFeedCache } from '@/lib/server/revalidatePulseFeed';
import { extractChainObservedAt } from '@/lib/helius/chainTimestamp';

function mergeBondingProgress(
  fromEvent: number | null | undefined,
  raw: Json,
  existing: number | null | undefined,
): number | null {
  const fromRaw = extractBondingProgressPct(raw);
  const candidates = [fromEvent, fromRaw, existing].filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

/**
 * Webhook feed ingestion — persist mint + raw enhanced-tx payload only.
 */
export async function ingestWebhookMintFromPayload(
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

  const existing = await getTokenByMint(ev.mint);
  const now = new Date().toISOString();
  const bonding_progress = mergeBondingProgress(ev.bonding_progress, rawWithSource, existing?.bonding_progress);
  const enrichedEv: LaunchpadEvent = { ...ev, raw: rawWithSource };

  if (existing) {
    const classPatch = classificationUpdateFromLaunchEvent(enrichedEv, existing, opts.alertSource);
    await updateToken(ev.mint, {
      last_seen_at: now,
      raw_metadata: rawWithSource,
      ...(bonding_progress != null ? { bonding_progress } : {}),
      symbol: ev.symbol ?? existing.symbol,
      name: ev.name ?? existing.name,
      creator_wallet: ev.creator_wallet ?? existing.creator_wallet,
      launch_pad: existing.launch_pad ?? (ev.launchpad === 'unknown' ? null : ev.launchpad),
      ...(classPatch ?? {}),
    });
    revalidatePulseFeedCache();
    return 0;
  }

  const base: TablesInsert<'tokens'> = {
    mint: ev.mint,
    symbol: ev.symbol,
    name: ev.name,
    decimals: 6,
    image_url: ev.image_url,
    creator_wallet: ev.creator_wallet,
    launch_pad: ev.launchpad === 'unknown' ? null : ev.launchpad,
    raw_metadata: rawWithSource,
    initial_liquidity_sol: ev.initial_liquidity_sol,
    initial_liquidity_at: ev.initial_liquidity_sol != null ? now : null,
    bonding_progress,
    created_at: extractChainObservedAt(rawWithSource) ?? now,
    last_seen_at: now,
  };

  const row = enrichTokenInsertFromLaunchEvent(base, enrichedEv, opts.alertSource);

  await upsertToken(row);
  revalidatePulseFeedCache();
  await emitGlobalPulseNewTokenAlert({
    mint: ev.mint,
    symbol: ev.symbol,
    name: ev.name,
    launchpad: ev.launchpad === 'unknown' ? null : ev.launchpad,
    source: opts.alertSource,
    creator_wallet: ev.creator_wallet,
    tx_signature: opts.txSignature ?? undefined,
    initial_liquidity_sol: ev.initial_liquidity_sol,
    protocol_id: row.protocol_id ?? null,
    source_confidence: row.source_confidence ?? null,
  });
  return 1;
}
