'use client';

import { useEffect, useRef } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useAlertsTickerQuery } from '@/lib/hooks/useAlertsTicker';
import {
  isAutoLaunchTwitterListenAlert,
  tweetFromAutoLaunchPayload,
  parseTwitterListenAutoLaunchPayload,
} from '@/lib/alerts/autoLaunchDispatch';
import { openDeployForTweetAsync } from '@/lib/launch/openLaunchModal';
import { useAutoLaunchStore } from '@/store/autoLaunch';
import { toast } from 'sonner';

export function AutoLaunchExecutor() {
  const { authenticated } = usePointerAuth();
  const { data } = useAlertsTickerQuery({ pollAggressively: true });
  const seenIds = useRef<Set<string>>(new Set());
  const hydrated = useRef(false);
  const inFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!authenticated || !data) return;

    if (!hydrated.current) {
      for (const a of data) seenIds.current.add(a.id);
      hydrated.current = true;
      return;
    }

    const prefs = useAutoLaunchStore.getState();
    if (!prefs.autoLaunchEnabled) return;

    for (const alert of data) {
      if (seenIds.current.has(alert.id)) continue;
      seenIds.current.add(alert.id);
      if (!isAutoLaunchTwitterListenAlert(alert.type, alert.payload)) continue;

      const p = parseTwitterListenAutoLaunchPayload(alert.payload)!;
      const parsed = tweetFromAutoLaunchPayload(p);
      if (!parsed) continue;

      const dedupeKey = alert.id;
      if (inFlight.current.has(dedupeKey)) continue;
      inFlight.current.add(dedupeKey);

      void (async () => {
        try {
          toast.message('AI auto-launch', {
            description: `@${parsed.tweet.authorHandle.replace(/^@/, '')} · opening deploy…`,
          });
          await openDeployForTweetAsync(
            parsed.subject,
            parsed.tweet,
            prefs.launchMode === 'ai',
          );
        } catch {
          toast.error('Auto-launch failed', {
            description: 'Could not open deploy modal for this tweet.',
          });
        } finally {
          inFlight.current.delete(dedupeKey);
        }
      })();
    }
  }, [authenticated, data]);

  return null;
}
