'use client';

import { useEffect, useRef } from 'react';
import { useAlertsTickerQuery } from '@/lib/hooks/useAlertsTicker';
import { useDeferredMount } from '@/lib/hooks/useDeferredMount';
import { showWalletTrackerTradeToast } from '@/lib/walletTracker/walletTrackerToast';

type TradePayload = {
  wallet?: string;
  walletLabel?: string;
  mint?: string;
  symbol?: string | null;
  side?: 'buy' | 'sell';
  solAmount?: number;
  marketCapUsd?: number | null;
  signature?: string;
  isKol?: boolean;
};

function formatMcLabel(mc: number | null | undefined): string | undefined {
  if (mc == null || !Number.isFinite(mc) || mc <= 0) return undefined;
  if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(1)}M`;
  if (mc >= 1_000) return `$${(mc / 1_000).toFixed(1)}K`;
  return `$${Math.round(mc)}`;
}

/** Bridge persisted tracked-wallet trade alerts → wallet-tracker toast channel. */
export function WalletTrackerAlertBridge() {
  // Poll globally at the slow 30s cadence (not the 8s firehose), and only after
  // first paint settles so the toast loop never contends for connections during
  // the cold-load window.
  const ready = useDeferredMount(2_500);
  const { data: alerts } = useAlertsTickerQuery({ background: true, enabled: ready });
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!alerts?.length) return;
    for (const alert of alerts) {
      if (alert.type !== 'tracked_wallet_trade') continue;
      if (seenRef.current.has(alert.id)) continue;
      seenRef.current.add(alert.id);

      const p = (alert.payload ?? {}) as TradePayload;
      const side = p.side === 'sell' ? 'sell' : 'buy';
      const walletKey = p.wallet ?? 'tracked';
      const walletLabel = p.walletLabel ?? walletKey.slice(0, 6);

      showWalletTrackerTradeToast({
        walletLabel,
        walletKey,
        side,
        actionLabel: side === 'buy' ? 'bought' : 'sold',
        tokenSymbol: p.symbol?.replace(/^\$/, '') ?? 'TOKEN',
        tokenImageUrl: '',
        solAmount:
          p.solAmount != null && Number.isFinite(p.solAmount)
            ? p.solAmount.toFixed(4)
            : '—',
        mcLabel: formatMcLabel(p.marketCapUsd) ?? '—',
        ageLabel: 'now',
        metaSuffix: p.isKol ? 'KOL · tracked' : 'tracked',
      });
    }
  }, [alerts]);

  return null;
}
