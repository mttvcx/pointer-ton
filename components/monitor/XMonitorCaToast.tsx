'use client';

import { useEffect } from 'react';
import { fireCaMentionToast } from '@/components/monitor/previewToasts';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { useTokenDockPeekStore } from '@/store/tokenDockPeek';
import { useXMonitorPreviewStore } from '@/store/xMonitorPreview';
import { useXMonitorSettings } from '@/store/xMonitorSettings';

/**
 * Fires a Discord CA-mention toast while the monitor is open + Preview is on +
 * the Discord source is enabled. Sample flow until real Discord ingest lands.
 */
export function XMonitorCaToast() {
  const railOpen = usePulseTwitterRailStore((s) => s.side !== 'hidden');
  const peekOpen = useTokenDockPeekStore((s) => s.xMonitorPeekOpen);
  const preview = useXMonitorPreviewStore((s) => s.preview);
  const discordOn = useXMonitorSettings((s) => s.sources.discord);

  const active = (railOpen || peekOpen) && preview && discordOn;

  useEffect(() => {
    if (!active) return;
    const first = window.setTimeout(fireCaMentionToast, 6000);
    const id = window.setInterval(fireCaMentionToast, 16000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [active]);

  return null;
}
