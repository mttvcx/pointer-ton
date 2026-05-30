'use client';

import { useQuery } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { selectCopilotSurfaceOpen, useUIStore } from '@/store/ui';

export type AlertsTickerItem = {
  id: string;
  type: string;
  payload: unknown;
  narration: string | null;
  createdAt: string;
};

/**
 * `@param options.pollAggressively` — Pulse / rail surfaces poll even while the copilot overlay is tucked away.
 */
export function useAlertsTickerQuery(options?: { pollAggressively?: boolean }) {
  const { authenticated, getAccessToken } = usePointerAuth();
  const copilotSurfaceOpen = useUIStore(selectCopilotSurfaceOpen);
  const aggressive = Boolean(options?.pollAggressively);
  const enabled = authenticated && (aggressive || copilotSurfaceOpen);

  return useQuery({
    queryKey: ['alerts-ticker', aggressive ? 'pulse' : 'default'],
    enabled,
    refetchInterval: aggressive ? 8000 : 30_000,
    staleTime: aggressive ? 4000 : 15_000,
    queryFn: async (): Promise<AlertsTickerItem[]> => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(`/api/alerts/ticker?limit=${aggressive ? 35 : 15}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json: unknown = await res.json();
      if (!res.ok) throw new Error('ticker_failed');
      const alerts = (json as { alerts?: AlertsTickerItem[] }).alerts;
      return Array.isArray(alerts) ? alerts : [];
    },
  });
}
