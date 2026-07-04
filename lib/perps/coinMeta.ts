const ICON: Record<string, string> = {
  BTC: '/chains/btc.png',
  ETH: '/chains/eth.png',
  SOL: '/chains/sol.png',
  HYPE: '/branding/hyperliquid.png',
};

/**
 * Real coin logo by symbol from a reliable CDN. The HL perp set is fixed (we add
 * to it deliberately), so unknown/newer symbols just fall back to a clean letter
 * avatar in the UI — never a broken/placeholder mark.
 */
function cdnCoinIcon(coin: string): string {
  return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${coin.toLowerCase()}.png`;
}

const TV: Record<string, string> = {
  BTC: 'BINANCE:BTCUSDT.P',
  ETH: 'BINANCE:ETHUSDT.P',
  SOL: 'BINANCE:SOLUSDT.P',
  HYPE: 'BINANCE:HYPEUSDT.P',
};

export function perpCoinIcon(coin: string): string {
  return ICON[coin.toUpperCase()] ?? cdnCoinIcon(coin);
}

export function perpTvSymbol(coin: string): string {
  const c = coin.toUpperCase();
  return TV[c] ?? `BINANCE:${c}USDT.P`;
}

export function perpMarketId(coin: string): string {
  return coin.toLowerCase();
}
