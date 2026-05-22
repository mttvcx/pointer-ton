'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueTwitterProfilePrefetch } from '@/lib/twitter/twitterProfilePrefetchQueue';
import { normalizeTwitterHandle } from '@/lib/twitter/twitterProfileQuery';

/**
 * When the row enters the viewport, enqueue a background Twitter profile prefetch.
 * Observer disconnects after the first intersection (one prefetch per mount cycle).
 */
export function usePrefetchTwitterProfileOnVisible(
  handle: string | null | undefined,
): (node: HTMLElement | null) => void {
  const queryClient = useQueryClient();
  const normalized = normalizeTwitterHandle(handle ?? '');
  const observerRef = useRef<IntersectionObserver | null>(null);

  const disconnect = useCallback(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, []);

  useEffect(() => disconnect, [disconnect]);

  return useCallback(
    (node: HTMLElement | null) => {
      disconnect();
      if (!node || !normalized) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            enqueueTwitterProfilePrefetch(queryClient, normalized);
            disconnect();
          }
        },
        { root: null, rootMargin: '0px', threshold: 0 },
      );

      observerRef.current = observer;
      observer.observe(node);
    },
    [disconnect, normalized, queryClient],
  );
}
