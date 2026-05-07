'use client';

import { useQuery } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';

export type AlertsTickerItem = {
  id: string;
  type: string;
  payload: unknown;
  narration: string | null;
  createdAt: string;
};

export function useAlertsTickerQuery() {
  const { authenticated, getAccessToken } = usePointerAuth();

  return useQuery({
    queryKey: ['alerts-ticker'],
    enabled: authenticated,
    refetchInterval: 30_000,
    staleTime: 15_000,
    queryFn: async (): Promise<AlertsTickerItem[]> => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/alerts/ticker?limit=15', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json: unknown = await res.json();
      if (!res.ok) throw new Error('ticker_failed');
      return (json as { alerts: AlertsTickerItem[] }).alerts;
    },
  });
}
