import 'server-only';

import { updateToken, type TokenRow } from '@/lib/db/tokens';
import { fetchPumpFunCoin, isLikelyPumpFunMint } from '@/lib/market/pumpFunCoin';
import type { Json } from '@/lib/supabase/types';

function isHeliusCdnUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.includes('helius-rpc.com') || u.includes('cdn-cgi/image');
}

function mergePumpRawMetadata(token: TokenRow, pump: NonNullable<Awaited<ReturnType<typeof fetchPumpFunCoin>>>): Json {
  const prev =
    token.raw_metadata && typeof token.raw_metadata === 'object' && !Array.isArray(token.raw_metadata)
      ? { ...(token.raw_metadata as Record<string, unknown>) }
      : ({} as Record<string, unknown>);
  const pumpMeta: Record<string, unknown> = {
    pumpFunHydrate: true,
    pumpComplete: pump.complete,
  };
  if (pump.twitter) pumpMeta.pumpTwitter = pump.twitter;
  if (pump.website) pumpMeta.pumpWebsite = pump.website;
  if (pump.telegram) pumpMeta.pumpTelegram = pump.telegram;
  return { ...prev, ...pumpMeta } as Json;
}

/** Best-effort pump.fun creator + socials + migration on token desk hydrate (no paid APIs). */
export async function hydratePumpFunTokenRow(mint: string, token: TokenRow): Promise<TokenRow> {
  if (!isLikelyPumpFunMint(mint, token.launch_pad)) return token;

  const pump = await fetchPumpFunCoin(mint);
  if (!pump) return token;

  const patch: Parameters<typeof updateToken>[1] = {};
  if (!token.creator_wallet?.trim() && pump.creator) patch.creator_wallet = pump.creator;
  if (!token.symbol?.trim() && pump.symbol) patch.symbol = pump.symbol;
  if (!token.name?.trim() && pump.name) patch.name = pump.name;
  if (!token.image_url?.trim() && pump.image_uri) patch.image_url = pump.image_uri;
  if (!token.launch_pad?.trim()) patch.launch_pad = 'pump.fun';
  if (!token.twitter_handle?.trim() && pump.twitter) patch.twitter_handle = pump.twitter;
  if (!token.telegram_url?.trim() && pump.telegram) patch.telegram_url = pump.telegram;
  if (
    !token.website_url?.trim() &&
    pump.website &&
    !isHeliusCdnUrl(pump.website)
  ) {
    patch.website_url = pump.website;
  }
  if (pump.complete && !token.migrated_at) {
    patch.migrated_at = new Date().toISOString();
    patch.bonding_progress = 100;
  }

  const raw = mergePumpRawMetadata(token, pump);
  if (JSON.stringify(raw) !== JSON.stringify(token.raw_metadata ?? null)) {
    patch.raw_metadata = raw;
  }

  if (Object.keys(patch).length === 0) return token;
  return updateToken(mint, patch);
}

/** True when pump.fun socials or migration may still be missing on a pump mint row. */
export function tokenNeedsPumpFunHydrate(token: TokenRow, mint: string): boolean {
  if (!isLikelyPumpFunMint(mint, token.launch_pad)) return false;
  return (
    !token.twitter_handle?.trim() ||
    !token.creator_wallet?.trim() ||
    !token.launch_pad?.trim() ||
    !token.migrated_at
  );
}
