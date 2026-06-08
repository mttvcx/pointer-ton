'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueCoinCommunityPrefetch } from '@/lib/communities/coinCommunityPrefetchQueue';

/**
 * When the row enters the viewport, enqueue a background Coin Communities prefetch.
 * Observer disconnects after the first intersection (one prefetch per mount cycle).
 */
export function usePrefetchCoinCommunityOnVisible(
  mint: string | null | undefined,
): (node: HTMLElement | null) => void {
  const queryClient = useQueryClient();
  const trimmed = mint?.trim() ?? '';
  const observerRef = useRef<IntersectionObserver | null>(null);

  const disconnect = useCallback(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, []);

  useEffect(() => disconnect, [disconnect]);

  return useCallback(
    (node: HTMLElement | null) => {
      disconnect();
      if (!node || !trimmed) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            enqueueCoinCommunityPrefetch(queryClient, trimmed);
            disconnect();
          }
        },
        { root: null, rootMargin: '120px 0px', threshold: 0 },
      );

      observerRef.current = observer;
      observer.observe(node);
    },
    [disconnect, trimmed, queryClient],
  );
}
