import 'server-only';

import { updateToken, type TokenRow } from '@/lib/db/tokens';
import { fetchPumpFunCoin, isLikelyPumpFunMint } from '@/lib/market/pumpFunCoin';

function isHeliusCdnUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.includes('helius-rpc.com') || u.includes('cdn-cgi/image');
}

/** Best-effort pump.fun creator + socials on token desk hydrate (no paid APIs). */
export async function hydratePumpFunTokenRow(mint: string, token: TokenRow): Promise<TokenRow> {
  if (!isLikelyPumpFunMint(mint, token.launch_pad)) return token;

  const pump = await fetchPumpFunCoin(mint);
  if (!pump) return token;

  const patch: Parameters<typeof updateToken>[1] = {};
  if (!token.creator_wallet?.trim() && pump.creator) patch.creator_wallet = pump.creator;
  if (!token.symbol?.trim() && pump.symbol) patch.symbol = pump.symbol;
  if (!token.name?.trim() && pump.name) patch.name = pump.name;
  if (!token.image_url?.trim() && pump.image_uri) patch.image_url = pump.image_uri;
  if (!token.twitter_handle?.trim() && pump.twitter) patch.twitter_handle = pump.twitter;
  if (!token.telegram_url?.trim() && pump.telegram) patch.telegram_url = pump.telegram;
  if (
    !token.website_url?.trim() &&
    pump.website &&
    !isHeliusCdnUrl(pump.website)
  ) {
    patch.website_url = pump.website;
  }

  if (Object.keys(patch).length === 0) return token;
  return updateToken(mint, patch);
}
