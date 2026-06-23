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
 * Unified alerts ticker source. Every consumer shares one query key
 * (`['alerts-ticker']`) so there is a single `/api/alerts/ticker` network loop
 * regardless of how many surfaces (copilot, rails, auto-buy/launch executors)
 * subscribe. This replaces the previous split `pulse`/`default` keys that ran
 * two concurrent poll loops everywhere.
 *
 * Polling cadence is per-observer; the shared query refetches at the fastest
 * active observer's interval:
 *  - `pollAggressively` → 8s (active trading surfaces / enabled executors)
 *  - otherwise          → 30s (copilot surface)
 *
 * @param options.pollAggressively — Pulse / rail surfaces poll even while the
 *   copilot overlay is tucked away.
 * @param options.background — poll globally (regardless of the copilot surface)
 *   at the SLOW 30s cadence. For always-mounted bridges that need fresh data but
 *   must not run the 8s firehose (e.g. the wallet-tracker toast bridge).
 * @param options.keepWhenHidden — keep this observer's interval alive while the
 *   browser tab is backgrounded. Only auto-buy / auto-launch executors that the
 *   user has explicitly enabled set this, so background execution is never
 *   silently paused. UI surfaces leave it `false` so polling stops when hidden.
 * @param options.enabled — lets a caller withdraw entirely (e.g. an executor
 *   whose feature toggle is off), so no polling happens when nothing consumes it.
 */
export function useAlertsTickerQuery(options?: {
  pollAggressively?: boolean;
  background?: boolean;
  keepWhenHidden?: boolean;
  enabled?: boolean;
}) {
  const { authenticated, getAccessToken } = usePointerAuth();
  const copilotSurfaceOpen = useUIStore(selectCopilotSurfaceOpen);
  const aggressive = Boolean(options?.pollAggressively);
  const background = Boolean(options?.background);
  const callerEnabled = options?.enabled ?? true;
  const enabled = authenticated && callerEnabled && (aggressive || background || copilotSurfaceOpen);

  return useQuery({
    queryKey: ['alerts-ticker'],
    enabled,
    refetchInterval: aggressive ? 8000 : 30_000,
    refetchIntervalInBackground: options?.keepWhenHidden ?? false,
    staleTime: aggressive ? 4000 : 15_000,
    queryFn: async (): Promise<AlertsTickerItem[]> => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/alerts/ticker?limit=35', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json: unknown = await res.json();
      if (!res.ok) throw new Error('ticker_failed');
      const alerts = (json as { alerts?: AlertsTickerItem[] }).alerts;
      return Array.isArray(alerts) ? alerts : [];
    },
  });
}
