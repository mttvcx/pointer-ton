import type { PredictionMarket } from '@/lib/predictions/types';

export function isCryptoPredictionMarket(m: PredictionMarket): boolean {
  if (m.category === 'Crypto' || m.category === 'ETFs') return true;
  const blob = `${m.title} ${m.outcomeLabel} ${m.tags.join(' ')}`.toLowerCase();
  return /crypto|bitcoin|btc|eth|ethereum|solana|\bsol\b|blockchain|defi|token|etf/.test(blob);
}

export type PredictionCardItem =
  | { kind: 'event'; id: string; title: string; markets: PredictionMarket[] }
  | { kind: 'single'; market: PredictionMarket };

/** Group sibling Kalshi markets (same event) into Axiom-style card squares. */
export function groupMarketsForCards(markets: PredictionMarket[]): PredictionCardItem[] {
  const byEvent = new Map<string, PredictionMarket[]>();
  const singles: PredictionMarket[] = [];

  for (const m of markets) {
    const key = m.eventTicker?.trim();
    if (key) {
      const list = byEvent.get(key) ?? [];
      list.push(m);
      byEvent.set(key, list);
    } else {
      singles.push(m);
    }
  }

  const items: PredictionCardItem[] = [];

  for (const [id, list] of byEvent) {
    const sorted = [...list].sort((a, b) => b.volumeUsd - a.volumeUsd);
    items.push({
      kind: 'event',
      id,
      title: sorted[0]?.title ?? id,
      markets: sorted,
    });
  }

  for (const m of singles) {
    items.push({ kind: 'single', market: m });
  }

  items.sort((a, b) => {
    const volA =
      a.kind === 'event'
        ? a.markets.reduce((s, m) => s + m.volumeUsd, 0)
        : a.market.volumeUsd;
    const volB =
      b.kind === 'event'
        ? b.markets.reduce((s, m) => s + m.volumeUsd, 0)
        : b.market.volumeUsd;
    return volB - volA;
  });

  return items;
}

export function aggregateEventStats(markets: PredictionMarket[]) {
  const primary = markets[0]!;
  return {
    volumeUsd: markets.reduce((s, m) => s + m.volumeUsd, 0),
    liquidityUsd: markets.reduce((s, m) => s + m.liquidityUsd, 0),
    endsIn: primary.endsIn,
    closeTime: primary.closeTime,
    category: primary.category,
    emoji: primary.emoji,
    iconUrl: primary.iconUrl,
    recentTrades: markets.flatMap((m) => m.recentTrades ?? []).slice(0, 6),
  };
}
