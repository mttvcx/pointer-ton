'use client';

import { useEffect } from 'react';
import { POINTER_PORTFOLIO_REFRESH_EVT } from '@/lib/client/portfolioRefreshEvents';

/** Event-driven portfolio refresh — replaces `refetchInterval` polling. */
export function usePortfolioRefreshListener(onRefresh: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const onEvent = () => onRefresh();
    const onFocus = () => onRefresh();
    const onVis = () => {
      if (document.visibilityState === 'visible') onRefresh();
    };

    window.addEventListener(POINTER_PORTFOLIO_REFRESH_EVT, onEvent);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);

    return () => {
      window.removeEventListener(POINTER_PORTFOLIO_REFRESH_EVT, onEvent);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled, onRefresh]);
}
