import 'server-only';

import { emitGlobalPulseNewTokenAlert } from '@/lib/alerts/generate';
import type { PulseNewTokenAlertInput } from '@/lib/alerts/pulseNewTokenTypes';
import { getTokenByMint, updateToken, upsertToken, type TokenRow } from '@/lib/db/tokens';
import type { LaunchpadEvent } from '@/lib/helius/parsers';
import {
  classificationUpdateFromLaunchEvent,
  enrichTokenInsertFromLaunchEvent,
} from '@/lib/protocol/enrichTokenRow';
import {
  classifyLaunchEventForIngest,
  isNonAuthorityDiscoverySource,
  meetsPulseDiscoveryThreshold,
} from '@/lib/protocol/pulseIngestGate';
import type { Json, TablesInsert } from '@/lib/supabase/types';
import { revalidatePulseFeedCache } from '@/lib/server/revalidatePulseFeed';
import { extractChainObservedAt } from '@/lib/helius/chainTimestamp';
import { extractSocialUrlsFromRaw } from '@/lib/tokens/pulseSocialLinks';

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

export function launchEventToTokenInsert(
  ev: Readonly<LaunchpadEvent>,
  alertSource: string,
  opts?: { dasAuthorityPad?: string | null },
): TablesInsert<'tokens'> {
  const now = new Date().toISOString();
  const chainAt = extractChainObservedAt(ev.raw);
  /** Socials persisted at ingest so Pulse strips show real icons from row one. */
  const socials = extractSocialUrlsFromRaw(ev.raw);
  const base: TablesInsert<'tokens'> = {
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
    website_url: socials.website_url,
    telegram_url: socials.telegram_url,
    twitter_handle: socials.twitter_handle,
    created_at: chainAt ?? now,
    last_seen_at: now,
  };
  return enrichTokenInsertFromLaunchEvent(base, ev, alertSource, {
    das_authority_pad: opts?.dasAuthorityPad ?? null,
  });
}

/**
 * Persist a launch discovery (DAS, Gecko, webhook). Returns 1 if a new mint row
 * was created, else 0.
 */
export type IngestLaunchpadDiscoveryResult = {
  created: 0 | 1;
  row: TokenRow | null;
};

export async function ingestLaunchpadDiscovery(
  ev: LaunchpadEvent,
  opts: {
    alertSource: PulseNewTokenAlertInput['source'];
    txSignature?: string | null;
    dasAuthorityPad?: string | null;
    /** Page hydrate already passed the pulse gate — skip duplicate inner gate. */
    bypassDiscoveryGate?: boolean;
  },
): Promise<IngestLaunchpadDiscoveryResult> {
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

    const launch_pad =
      existing.launch_pad ?? (enrichedEv.launchpad === 'unknown' ? null : enrichedEv.launchpad);

    const classPatch = classificationUpdateFromLaunchEvent(enrichedEv, existing, opts.alertSource, {
      das_authority_pad: opts.dasAuthorityPad ?? null,
    });

    /** Backfill social columns when previous ingest didn't extract them. */
    const socials = extractSocialUrlsFromRaw(rawWithSource);

    const row = await updateToken(enrichedEv.mint, {
      last_seen_at: now,
      raw_metadata: rawWithSource,
      symbol: enrichedEv.symbol ?? existing.symbol,
      name: enrichedEv.name ?? existing.name,
      image_url: enrichedEv.image_url ?? existing.image_url,
      creator_wallet: enrichedEv.creator_wallet ?? existing.creator_wallet,
      ...(!existing.website_url?.trim() && socials.website_url
        ? { website_url: socials.website_url }
        : {}),
      ...(!existing.telegram_url?.trim() && socials.telegram_url
        ? { telegram_url: socials.telegram_url }
        : {}),
      ...(!existing.twitter_handle?.trim() && socials.twitter_handle
        ? { twitter_handle: socials.twitter_handle }
        : {}),
      ...(bonding_progress != null ? { bonding_progress } : {}),
      ...(launch_pad != null ? { launch_pad } : {}),
      ...(classPatch ?? {}),
    });
    revalidatePulseFeedCache();
    return { created: 0, row };
  }

  if (
    !opts.bypassDiscoveryGate &&
    isNonAuthorityDiscoverySource(opts.alertSource)
  ) {
    const preview = classifyLaunchEventForIngest(enrichedEv, opts.alertSource, {
      dasAuthorityPad: opts.dasAuthorityPad ?? null,
    });
    if (!meetsPulseDiscoveryThreshold(preview)) {
      return { created: 0, row: null };
    }
  }

  const inserted = launchEventToTokenInsert(enrichedEv, opts.alertSource, {
    dasAuthorityPad: opts.dasAuthorityPad ?? null,
  });
  const row = await upsertToken(inserted);
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
    protocol_id: inserted.protocol_id ?? null,
    source_confidence: inserted.source_confidence ?? null,
  });
  return { created: 1, row };
}
