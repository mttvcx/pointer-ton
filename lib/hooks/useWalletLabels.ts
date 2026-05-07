'use client';

import { useCallback, useEffect } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { shortenAddress } from '@/lib/utils/addresses';
import {
  useWalletLabelsStore,
  type WalletLabelResolved,
} from '@/store/walletLabels';

export type ResolvedWalletDisplay =
  | {
      labeled: true;
      walletAddress: string;
      label: string;
      emoji: string | null;
      color: string;
      text: string;
    }
  | {
      labeled: false;
      walletAddress: string;
      text: string;
    };

const LABEL_COLOR_CLASS: Record<string, string> = {
  yellow: 'text-yellow-400',
  green: 'text-emerald-400',
  red: 'text-red-400',
  blue: 'text-sky-400',
  purple: 'text-violet-400',
};

export function labelColorClass(color: string): string {
  const fallback = 'text-yellow-400';
  return LABEL_COLOR_CLASS[color] ?? fallback;
}

/** Fetch labels once per session when authenticated; use store for reads. */
export function useWalletLabels() {
  const { authenticated, getAccessToken } = usePointerAuth();
  const byAddress = useWalletLabelsStore((s) => s.byAddress);
  const hydrateFromApi = useWalletLabelsStore((s) => s.hydrateFromApi);
  const reset = useWalletLabelsStore((s) => s.reset);
  const setPendingModalAddress = useWalletLabelsStore((s) => s.setPendingModalAddress);

  useEffect(() => {
    if (!authenticated) {
      reset();
      return;
    }
    let cancelled = false;
    (async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;
      const res = await fetch('/api/wallet-labels', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok || cancelled) return;
      const json = (await res.json()) as { labels: WalletLabelResolved[] };
      hydrateFromApi(json.labels ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken, hydrateFromApi, reset]);

  const resolveLabel = useCallback(
    (
      address: string | null | undefined,
      truncateLen = 3,
    ): ResolvedWalletDisplay | null => {
      if (!address) return null;
      const row = byAddress[address];
      if (!row) {
        return {
          labeled: false,
          walletAddress: address,
          text: shortenAddress(address, truncateLen),
        };
      }
      const prefix = row.emoji ? `${row.emoji} ` : '';
      return {
        labeled: true,
        walletAddress: address,
        label: row.label,
        emoji: row.emoji,
        color: row.color,
        text: `${prefix}${row.label}`.trim(),
      };
    },
    [byAddress],
  );

  const refresh = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const res = await fetch('/api/wallet-labels', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const json = (await res.json()) as { labels: WalletLabelResolved[] };
    hydrateFromApi(json.labels ?? []);
  }, [getAccessToken, hydrateFromApi]);

  return {
    resolveLabel,
    refresh,
    openLabelModal: setPendingModalAddress,
    byAddress,
  };
}
