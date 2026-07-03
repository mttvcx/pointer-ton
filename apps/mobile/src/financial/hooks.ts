import { useQuery } from '@tanstack/react-query';
import { DEMO, useAuth } from '../auth';
import { fetchYieldRate } from './api';

/**
 * Live Smart Yield APY (from the backend → Lulo). Disabled in demo and until
 * signed in. Returns the real % when the backend has a LULO_API_KEY, else null —
 * screens then fall back to their demo APY. Never throws into the UI.
 */
export function useYieldRate(): number | null {
  const auth = useAuth();
  const q = useQuery({
    queryKey: ['financial', 'yield'],
    queryFn: fetchYieldRate,
    enabled: !DEMO && auth.isLoggedIn,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return q.data?.configured ? q.data.apyPct ?? null : null;
}
