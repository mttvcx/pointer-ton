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
  const upsertLocal = useWalletLabelsStore((s) => s.upsertLocal);
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

  /** Save (track) a wallet with a name — optimistic upsert, defaults to yellow. */
  const saveLabel = useCallback(
    async (
      address: string,
      opts: { label: string; emoji?: string | null; color?: string },
    ): Promise<WalletLabelResolved> => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/wallet-labels', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address,
          label: opts.label.trim(),
          emoji: opts.emoji ?? null,
          color: opts.color ?? 'yellow',
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { label?: WalletLabelResolved; error?: string };
      if (!res.ok || !json.label) throw new Error(typeof json.error === 'string' ? json.error : 'save_failed');
      upsertLocal(json.label);
      return json.label;
    },
    [getAccessToken, upsertLocal],
  );

  return {
    resolveLabel,
    refresh,
    saveLabel,
    openLabelModal: setPendingModalAddress,
    byAddress,
  };
}
