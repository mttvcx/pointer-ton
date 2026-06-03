const ICON: Record<string, string> = {
  BTC: '/chains/btc.png',
  ETH: '/chains/eth.png',
  SOL: '/chains/sol.png',
};

const TV: Record<string, string> = {
  BTC: 'BINANCE:BTCUSDT.P',
  ETH: 'BINANCE:ETHUSDT.P',
  SOL: 'BINANCE:SOLUSDT.P',
  HYPE: 'BINANCE:HYPEUSDT.P',
};

export function perpCoinIcon(coin: string): string {
  return ICON[coin.toUpperCase()] ?? '/chains/hyperliquid.svg';
}

export function perpTvSymbol(coin: string): string {
  const c = coin.toUpperCase();
  return TV[c] ?? `BINANCE:${c}USDT.P`;
}

export function perpMarketId(coin: string): string {
  return coin.toLowerCase();
}
