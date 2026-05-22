'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { aiScanClientKey, fetchAiScan } from '@/lib/client/fetchAiScan';
import type { ExplainTokenOutput, ExplainWalletOutput } from '@/lib/ai/schemas';
import type { AlertsTickerItem } from '@/lib/hooks/useAlertsTicker';
import { ALERT_TYPE_TWITTER_LISTEN } from '@/lib/alerts/alertRuleModel';
import { selectCopilotSurfaceOpen, useUIStore, type EntityRef } from '@/store/ui';
import { shortenAddress } from '@/lib/utils/addresses';

const HOVER_DEBOUNCE_MS = 350;
const MIN_ROTATE_MS = 4000;
const MAX_LINE = 130;

const GENERAL_TICKS = [
  'Hover a token row for instant AI context.',
  'Pin a target in the co-pilot to lock your research.',
  'Alert rules surface launches that match your thesis.',
  'Track wallets to catch their next moves in your feed.',
] as const;

function useDebouncedEntity(entity: EntityRef | null): EntityRef | null {
  const [value, setValue] = useState<EntityRef | null>(entity);
  useEffect(() => {
    const delay = entity ? HOVER_DEBOUNCE_MS : 0;
    const t = window.setTimeout(() => setValue(entity), delay);
    return () => window.clearTimeout(t);
  }, [entity?.type, entity?.id, entity?.label, entity]);
  return value;
}

function truncate(s: string, n: number) {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

function alertTier(a: AlertsTickerItem): number {
  if (/tracker|tracked_wallet/i.test(a.type)) return 0;
  if (
    a.type === 'alert_rule' ||
    a.type === ALERT_TYPE_TWITTER_LISTEN ||
    a.type === 'limit_alert_triggered'
  )
    return 1;
  return 2;
}

function alertLine(a: AlertsTickerItem): string {
  if (a.narration?.trim()) return truncate(a.narration.trim(), MAX_LINE);
  return truncate(String(a.type).replace(/_/g, ' '), MAX_LINE);
}

function tierLabel(tier: number): 'tracked' | 'rule' | 'general' {
  if (tier === 0) return 'tracked';
  if (tier === 1) return 'rule';
  return 'general';
}

export type CopilotPillInsight = {
  key: string;
  text: string;
  tier: 'hover' | 'tracked' | 'rule' | 'general';
};

export function useCopilotPillInsight(alerts: AlertsTickerItem[] | undefined): CopilotPillInsight {
  const hovered = useUIStore((s) => s.hoveredEntity);
  const copilotSurfaceOpen = useUIStore(selectCopilotSurfaceOpen);
  const debouncedHover = useDebouncedEntity(hovered);
  const { authenticated, getAccessToken } = usePointerAuth();

  const hoverKey = debouncedHover ? `${debouncedHover.type}:${debouncedHover.id}` : null;

  const explainQ = useQuery({
    queryKey: ['copilot-pill-explain', debouncedHover?.type, debouncedHover?.id] as const,
    enabled: Boolean(authenticated && debouncedHover && copilotSurfaceOpen),
    staleTime: 60_000,
    retry: 0,
    queryFn: async () => {
      if (!debouncedHover) throw new Error('no_entity');
      const url =
        debouncedHover.type === 'token' ? '/api/ai/explain-token' : '/api/ai/explain-wallet';
      const body =
        debouncedHover.type === 'token'
          ? { mint: debouncedHover.id, mode: 'fast' as const, surface: 'copilot' as const }
          : { address: debouncedHover.id, mode: 'fast' as const };
      const key = aiScanClientKey(url, body);
      return fetchAiScan(key, async () => {
        const token = await getAccessToken();
        if (!token) throw new Error('no_token');
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
        const json: unknown = await res.json();
        if (!res.ok) throw new Error('explain_failed');
        return json as { data: ExplainTokenOutput | ExplainWalletOutput };
      });
    },
  });

  const rotatePool = useMemo((): CopilotPillInsight[] => {
    const pool: CopilotPillInsight[] = [];
    if (alerts?.length) {
      const ranked = [...alerts].sort((a, b) => {
        const ra = alertTier(a);
        const rb = alertTier(b);
        if (ra !== rb) return ra - rb;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      for (const a of ranked) {
        pool.push({
          key: `alert-${a.id}`,
          text: alertLine(a),
          tier: tierLabel(alertTier(a)),
        });
      }
    }
    GENERAL_TICKS.forEach((text, i) => {
      pool.push({ key: `tip-${i}`, text, tier: 'general' });
    });
    return pool;
  }, [alerts]);

  const [rotateIdx, setRotateIdx] = useState(0);

  const hoverInsight = useMemo((): CopilotPillInsight | null => {
    if (!debouncedHover || !authenticated) return null;
    if (explainQ.isLoading) {
      const hint =
        debouncedHover.label ??
        (debouncedHover.type === 'token'
          ? shortenAddress(debouncedHover.id, 4)
          : shortenAddress(debouncedHover.id, 3));
      return {
        key: `hover-loading-${hoverKey}`,
        text: `Analyzing ${hint}…`,
        tier: 'hover',
      };
    }
    if (explainQ.data?.data && 'summary' in explainQ.data.data) {
      const summary = explainQ.data.data.summary;
      const label =
        debouncedHover.label ??
        (debouncedHover.type === 'token'
          ? shortenAddress(debouncedHover.id, 4)
          : shortenAddress(debouncedHover.id, 3));
      const prefix = debouncedHover.type === 'token' ? `${label} · ` : `Wallet ${label} · `;
      return {
        key: `hover-${hoverKey}`,
        text: truncate(`${prefix}${summary}`, MAX_LINE + 24),
        tier: 'hover',
      };
    }
    if (explainQ.isError) {
      return {
        key: `hover-err-${hoverKey}`,
        text: 'AI context unavailable — open co-pilot for details.',
        tier: 'hover',
      };
    }
    return null;
  }, [authenticated, debouncedHover, explainQ.data, explainQ.isError, explainQ.isLoading, hoverKey]);

  useEffect(() => {
    if (hoverInsight) return;
    if (rotatePool.length === 0) return;
    const t = window.setInterval(() => {
      setRotateIdx((i) => (i + 1) % rotatePool.length);
    }, MIN_ROTATE_MS);
    return () => window.clearInterval(t);
  }, [hoverInsight, rotatePool.length]);

  return useMemo(() => {
    if (hoverInsight) return hoverInsight;
    if (rotatePool.length === 0) {
      return {
        key: 'idle',
        text: authenticated
          ? 'Pointer Co-pilot is watching your markets.'
          : 'Sign in for live AI insights and alerts.',
        tier: 'general' as const,
      };
    }
    return rotatePool[rotateIdx % rotatePool.length]!;
  }, [authenticated, hoverInsight, rotatePool, rotateIdx]);
}
