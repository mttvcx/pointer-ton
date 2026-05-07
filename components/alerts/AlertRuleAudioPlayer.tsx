'use client';

import { useEffect, useRef } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useAlertsTickerQuery } from '@/lib/hooks/useAlertsTicker';
import { ALERT_TYPE_ALERT_RULE } from '@/lib/alerts/alertRuleModel';
import {
  playAlertRuleAudio,
  readAudioFromAlertPayload,
} from '@/lib/alerts/alertRulePayloadAudio';

/**
 * Plays optional chime / custom HTTPS audio when a new `alert_rule` alert lands.
 * Mirrors {@link AlertRuleFlashLayer} session hydration so history does not replay.
 */
export function AlertRuleAudioPlayer() {
  const { authenticated } = usePointerAuth();
  const { data } = useAlertsTickerQuery();
  const seenIds = useRef<Set<string>>(new Set());
  const hydrated = useRef(false);

  useEffect(() => {
    if (!authenticated || !data) return;

    if (!hydrated.current) {
      for (const a of data) seenIds.current.add(a.id);
      hydrated.current = true;
      return;
    }

    void (async () => {
      for (const a of data) {
        if (seenIds.current.has(a.id)) continue;
        seenIds.current.add(a.id);
        if (a.type !== ALERT_TYPE_ALERT_RULE) continue;
        const audio = readAudioFromAlertPayload(a.payload);
        if (!audio || audio.enabled === false) continue;
        await playAlertRuleAudio(audio);
        break;
      }
    })();
  }, [authenticated, data]);

  return null;
}
