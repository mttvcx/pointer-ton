export type PerpMarket = {
  id: string;
  /** Hyperliquid coin symbol (e.g. BTC) */
  coin: string;
  label: string;
  iconSrc: string;
  tvSymbol: string;
  mark: number;
  oraclePx: number;
  chg24: number;
  /** Hourly funding rate as decimal (e.g. 0.0000125) */
  fundingHourly: number;
  /** Annualized funding % for display */
  fundingApr: number;
  /** Human countdown to next hourly funding */
  fundingCountdown: string;
  oiUsd: number;
  vol24Usd: number;
  maxLeverage: number;
};

export type PerpsL2Level = {
  px: number;
  sz: number;
  n: number;
};

export type PerpsL2Book = {
  coin: string;
  bids: PerpsL2Level[];
  asks: PerpsL2Level[];
  spreadBps: number;
  mark: number;
};
