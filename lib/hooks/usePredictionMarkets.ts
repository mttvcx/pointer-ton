'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  PredictionDeskCategory,
  PredictionMarketsResponse,
  PredictionSort,
} from '@/lib/predictions/types';

export type UsePredictionMarketsParams = {
  deskCategory: PredictionDeskCategory;
  tag?: string | null;
  query?: string;
  sort?: PredictionSort;
};

export function usePredictionMarkets(params: UsePredictionMarketsParams) {
  return useQuery({
    queryKey: [
      'prediction-markets',
      params.deskCategory,
      params.tag ?? '',
      params.query ?? '',
      params.sort ?? 'volume',
    ],
    queryFn: async () => {
      const qs = new URLSearchParams({
        deskCategory: params.deskCategory,
        sort: params.sort ?? 'volume',
      });
      if (params.tag) qs.set('tag', params.tag);
      if (params.query?.trim()) qs.set('q', params.query.trim());
      const res = await fetch(`/api/predictions/markets?${qs.toString()}`);
      const json = (await res.json()) as PredictionMarketsResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'markets_failed');
      return json;
    },
    staleTime: 12_000,
    refetchInterval: 20_000,
  });
}

export function usePredictionMarket(ticker: string) {
  return useQuery({
    queryKey: ['prediction-market', ticker],
    queryFn: async () => {
      const res = await fetch(`/api/predictions/markets/${encodeURIComponent(ticker)}`);
      const json = (await res.json()) as {
        market?: import('@/lib/predictions/types').PredictionMarket;
        outcomes?: import('@/lib/predictions/types').PredictionMarket[];
        error?: string;
      };
      if (!res.ok || !json.market) throw new Error(json.error ?? 'market_not_found');
      return {
        market: json.market,
        outcomes: json.outcomes ?? [json.market],
      };
    },
    enabled: Boolean(ticker),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function usePredictionTrades(ticker?: string) {
  return useQuery({
    queryKey: ['prediction-trades', ticker ?? 'all'],
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: '40' });
      if (ticker) qs.set('ticker', ticker);
      const res = await fetch(`/api/predictions/trades?${qs.toString()}`);
      const json = (await res.json()) as {
        trades?: import('@/lib/predictions/types').PredictionRecentTrade[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? 'trades_failed');
      return json.trades ?? [];
    },
    staleTime: 4_000,
    refetchInterval: 8_000,
  });
}

export function useKalshiOrderConfigured() {
  return useQuery({
    queryKey: ['kalshi-order-configured'],
    queryFn: async () => {
      const res = await fetch('/api/predictions/orders');
      const json = (await res.json()) as { configured?: boolean };
      return Boolean(json.configured);
    },
    staleTime: 60_000,
  });
}
