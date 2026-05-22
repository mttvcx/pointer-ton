export type PerpMarket = {
  id: string;
  label: string;
  coin: string;
  iconSrc: string;
  tvSymbol: string;
  mark: number;
  chg24: number;
  fundingApr: number;
  fundingCountdown: string;
  oiUsd: number;
  vol24Usd: number;
  maxLeverage: number;
};

export const DEMO_PERP_MARKETS: PerpMarket[] = [
  {
    id: 'btc',
    label: 'BTC-PERP',
    coin: 'BTC',
    iconSrc: '/chains/btc.png',
    tvSymbol: 'BINANCE:BTCUSDT.P',
    mark: 98420,
    chg24: -0.41,
    fundingApr: 8.2,
    fundingCountdown: '06h 14m',
    oiUsd: 1.25e9,
    vol24Usd: 3.42e9,
    maxLeverage: 40,
  },
  {
    id: 'eth',
    label: 'ETH-PERP',
    coin: 'ETH',
    iconSrc: '/chains/eth.svg',
    tvSymbol: 'BINANCE:ETHUSDT.P',
    mark: 2654.3,
    chg24: 1.18,
    fundingApr: 6.4,
    fundingCountdown: '02h 22m',
    oiUsd: 820e6,
    vol24Usd: 1.95e9,
    maxLeverage: 25,
  },
  {
    id: 'sol',
    label: 'SOL-PERP',
    coin: 'SOL',
    iconSrc: '/chains/sol.png',
    tvSymbol: 'BINANCE:SOLUSDT.P',
    mark: 187.42,
    chg24: 2.76,
    fundingApr: 11.1,
    fundingCountdown: '04h 48m',
    oiUsd: 410e6,
    vol24Usd: 980e6,
    maxLeverage: 20,
  },
  {
    id: 'hype',
    label: 'HYPE-PERP',
    coin: 'HYPE',
    iconSrc: '/chains/sol.png',
    tvSymbol: 'BINANCE:HYPEUSDT.P',
    mark: 24.18,
    chg24: 4.82,
    fundingApr: 14.2,
    fundingCountdown: '01h 52m',
    oiUsd: 188e6,
    vol24Usd: 420e6,
    maxLeverage: 10,
  },
  {
    id: 'zec',
    label: 'ZEC-PERP',
    coin: 'ZEC',
    iconSrc: '/chains/btc.png',
    tvSymbol: 'BINANCE:ZECUSDT.P',
    mark: 42.6,
    chg24: -1.24,
    fundingApr: 9.8,
    fundingCountdown: '03h 08m',
    oiUsd: 96e6,
    vol24Usd: 210e6,
    maxLeverage: 10,
  },
  {
    id: 'lit',
    label: 'LIT-PERP',
    coin: 'LIT',
    iconSrc: '/chains/eth.svg',
    tvSymbol: 'BINANCE:LITUSDT.P',
    mark: 3.42,
    chg24: 6.15,
    fundingApr: 18.4,
    fundingCountdown: '05h 41m',
    oiUsd: 44e6,
    vol24Usd: 88e6,
    maxLeverage: 5,
  },
];

export function fmtPerpUsdCompact(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}b`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}m`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}
