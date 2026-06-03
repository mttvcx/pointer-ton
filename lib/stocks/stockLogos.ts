/** Demo equity logos — FMP tickers + domain favicons. Replace when provider ships art. */

const PUBLIC_TICKERS = new Set([
  'TSLA',
  'NVDA',
  'MSTR',
  'COIN',
  'HOOD',
  'AAPL',
  'MSFT',
  'AMZN',
  'META',
  'GOOGL',
  'SPX',
]);

const DOMAIN_BY_SYMBOL: Record<string, string> = {
  OPENAI: 'openai.com',
  SPACEX: 'spacex.com',
  ANTHROPIC: 'anthropic.com',
  STRIPE: 'stripe.com',
  XAI: 'x.ai',
  PERPLEXITY: 'perplexity.ai',
  TSLA: 'tesla.com',
  NVDA: 'nvidia.com',
  MSTR: 'microstrategy.com',
  COIN: 'coinbase.com',
  HOOD: 'robinhood.com',
  AAPL: 'apple.com',
  MSFT: 'microsoft.com',
  AMZN: 'amazon.com',
  META: 'meta.com',
  GOOGL: 'google.com',
  SPX: 'spglobal.com',
};

export function getStockLogoCandidates(symbol: string): string[] {
  const key = symbol.trim().toUpperCase();
  const urls: string[] = [];

  if (PUBLIC_TICKERS.has(key)) {
    urls.push(`https://financialmodelingprep.com/image-stock/${key}.png`);
  }

  const domain = DOMAIN_BY_SYMBOL[key];
  if (domain) {
    urls.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`);
  }

  return urls;
}

/** @deprecated Use getStockLogoCandidates + StockAvatar */
export function getStockLogoUrl(symbol: string): string | null {
  const list = getStockLogoCandidates(symbol);
  return list[0] ?? null;
}
