import type { PredictionMarket } from '@/lib/predictions/marketsDemo';

/** Official asset logos (CoinGecko CDN — standard market icons). */
export const PREDICTION_ASSET_ICON_URLS = {
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
} as const;

export function resolvePredictionMarketIconUrl(market: PredictionMarket): string | null {
  if (market.iconUrl) return market.iconUrl;

  const hay = `${market.title} ${market.tags.join(' ')} ${market.id}`.toLowerCase();
  if (hay.includes('ethereum') || hay.includes(' eth') || hay.includes('eth-')) {
    return PREDICTION_ASSET_ICON_URLS.ETH;
  }
  if (hay.includes('bitcoin') || hay.includes(' btc') || hay.includes('btc-')) {
    return PREDICTION_ASSET_ICON_URLS.BTC;
  }
  if (hay.includes('solana') || hay.includes(' sol') || hay.includes('sol-')) {
    return PREDICTION_ASSET_ICON_URLS.SOL;
  }
  return null;
}
