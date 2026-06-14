import 'server-only';

import type { KalshiMarket, KalshiTrade } from '@/lib/kalshi/schemas';
import type {
  PredictionAlphaItem,
  PredictionCategory,
  PredictionMarket,
  PredictionRecentTrade,
  PredictionTrend,
} from '@/lib/predictions/types';

function parseDollars(v: string | number | undefined | null): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function parseFpCount(v: string | number | undefined | null): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function dollarsToCents(d: number): number {
  return Math.round(d * 1000) / 10;
}

function inferCategory(raw: string | undefined, title: string): PredictionCategory {
  const s = `${raw ?? ''} ${title}`.toLowerCase();
  if (/^crypto|cryptocurrency|digital asset/.test(raw?.toLowerCase() ?? '')) return 'Crypto';
  if (/^sport|entertainment/.test(raw?.toLowerCase() ?? '')) return 'Sports';
  if (/^politic|election|government/.test(raw?.toLowerCase() ?? '')) return 'Politics';
  if (/^econom|finance|financial|fed/.test(raw?.toLowerCase() ?? '')) return 'Macro';
  if (/^science|tech|technology|ai/.test(raw?.toLowerCase() ?? '')) return 'AI';
  if (/crypto|bitcoin|btc|eth|ethereum|solana|sol\b|token|defi|blockchain|nft|etf|digital asset|hit in 20/.test(s))
    return 'Crypto';
  if (/nba|nfl|mlb|soccer|sport|world cup|tennis|ufc|game|match|basketball|baseball|hockey/.test(s))
    return 'Sports';
  if (/president|election|congress|politic|trump|senate|vote|fed chair|speaker|democrat|republican/.test(s))
    return 'Politics';
  if (/ai|openai|anthropic|gpt|model|agi|llm/.test(s)) return 'AI';
  if (/stock|s&p|nasdaq|etf|earnings|ipo|nvidia|apple|tesla/.test(s)) return 'Stocks';
  if (/gdp|cpi|inflation|rate|macro|economy|jobs|fed\b|recession/.test(s)) return 'Macro';
  if (/climate|weather|warming|volcano/.test(s)) return 'Macro';
  return 'Politics';
}

function formatEndsIn(closeTime?: string): string {
  if (!closeTime) return '—';
  const t = Date.parse(closeTime);
  if (!Number.isFinite(t)) return '—';
  const diff = t - Date.now();
  if (diff <= 0) return 'closed';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 60) return `${days}d`;
  const mo = Math.floor(days / 30);
  if (mo < 24) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}

function sparkFromPrices(current: number, previous: number, points = 14): number[] {
  const out: number[] = [];
  const end = Math.max(0.02, Math.min(0.98, current));
  const start = Math.max(0.02, Math.min(0.98, previous || end * 0.92));
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const wave = Math.sin(i * 0.7) * 0.015;
    out.push(Math.max(0.02, Math.min(0.98, start + (end - start) * t + wave)));
  }
  out[points - 1] = end;
  return out;
}

function emojiForCategory(cat: PredictionCategory): string {
  switch (cat) {
    case 'Crypto':
      return '₿';
    case 'Sports':
      return '🏆';
    case 'Politics':
      return '🗳️';
    case 'AI':
      return '🤖';
    case 'Stocks':
      return '📈';
    case 'Macro':
      return '🏛️';
    default:
      return '📊';
  }
}

function alphaFeedForMarket(title: string, category: PredictionCategory): PredictionAlphaItem[] {
  const q = encodeURIComponent(title.slice(0, 80));
  const base: PredictionAlphaItem[] = [
    {
      id: 'yt',
      title: `${title} — prediction breakdown`,
      url: `https://www.youtube.com/results?search_query=${q}+prediction+market`,
      source: 'YouTube',
      ago: '2h',
      kind: 'youtube',
    },
    {
      id: 'blog',
      title: `Market analysis: ${title}`,
      url: `https://news.google.com/search?q=${q}`,
      source: 'News',
      ago: '5h',
      kind: 'news',
    },
  ];
  if (category === 'Crypto') {
    base.unshift({
      id: 'coingecko',
      title: 'SOL/USD spot reference',
      url: 'https://www.coingecko.com/en/coins/solana',
      source: 'CoinGecko',
      ago: 'live',
      kind: 'analysis',
    });
  }
  return base.slice(0, 4);
}

export function mapKalshiTrade(t: KalshiTrade): PredictionRecentTrade {
  const yesPx = dollarsToCents(parseDollars(t.yes_price_dollars));
  const noPx = dollarsToCents(parseDollars(t.no_price_dollars));
  const side = t.taker_side === 'no' ? 'no' : 'yes';
  return {
    id: t.trade_id ?? `${t.ticker}-${t.created_time ?? Date.now()}`,
    side,
    priceCents: side === 'yes' ? yesPx : noPx,
    count: Math.round(parseFpCount(t.count_fp ?? t.count)),
    ts: t.created_time ? Date.parse(t.created_time) : Date.now(),
  };
}

export function mapKalshiMarket(
  m: KalshiMarket,
  eventTitle?: string,
  eventCategory?: string,
): PredictionMarket {
  const last = parseDollars(m.last_price_dollars);
  const yesAsk = parseDollars(m.yes_ask_dollars);
  const yesBid = parseDollars(m.yes_bid_dollars);
  const noAsk = parseDollars(m.no_ask_dollars);
  const noBid = parseDollars(m.no_bid_dollars);
  const prev = parseDollars(m.previous_price_dollars);

  const yesMid =
    yesAsk > 0 && yesBid > 0
      ? (yesAsk + yesBid) / 2
      : last > 0
        ? last
        : yesAsk || yesBid;
  const noMid =
    noAsk > 0 && noBid > 0
      ? (noAsk + noBid) / 2
      : Math.max(0, 1 - yesMid);

  const yesPriceCents = dollarsToCents(yesMid);
  const noPriceCents = dollarsToCents(noMid);
  const yesPct = Math.round(yesMid * 100);
  const changeCents = dollarsToCents(yesMid - (prev || yesMid));
  const changePct24h =
    prev > 0 ? Math.round(((yesMid - prev) / prev) * 1000) / 10 : 0;
  const trend: PredictionTrend =
    changeCents > 0.05 ? 'up' : changeCents < -0.05 ? 'down' : 'flat';

  const title =
    eventTitle?.trim() ||
    m.title?.trim() ||
    m.subtitle?.trim() ||
    m.ticker;
  const outcomeLabel = m.yes_sub_title?.trim() || 'Yes';
  const category = inferCategory(eventCategory ?? m.category, title);
  const volContracts = parseFpCount(m.volume_fp);
  const vol24 = parseFpCount(m.volume_24h_fp);
  const oi = parseFpCount(m.open_interest_fp);

  return {
    id: m.ticker,
    ticker: m.ticker,
    eventTicker: m.event_ticker,
    title,
    outcomeLabel,
    yesPct,
    yesPriceCents,
    noPriceCents,
    changePct24h,
    changeCents24h: changeCents,
    trend,
    category,
    tags: [category, ...(m.event_ticker ? [m.event_ticker] : [])],
    volumeUsd: Math.round(vol24 * yesMid * 100) / 100 || Math.round(volContracts * yesMid),
    liquidityUsd: Math.round(parseDollars(m.liquidity_dollars) * 100) / 100 || Math.round(oi * yesMid),
    txns: Math.round(vol24) || Math.round(volContracts),
    txnBuys: Math.round(vol24 * 0.58),
    txnSells: Math.round(vol24 * 0.42),
    traders: Math.max(1, Math.round(oi / 4)),
    endsIn: formatEndsIn(m.close_time),
    closeTime: m.close_time,
    spark: sparkFromPrices(yesMid, prev || yesMid * 0.94),
    emoji: emojiForCategory(category),
    alphaFeed: alphaFeedForMarket(title, category),
  };
}
