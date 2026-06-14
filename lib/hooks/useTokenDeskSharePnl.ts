'use client';

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AppChainId } from '@/lib/chains/appChain';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useActiveSolanaWallet, type MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { useDeskWalletStats } from '@/lib/hooks/useDeskWalletStats';
import {
  buildTokenDeskSharePayload,
  hasTokenDeskShareActivity,
} from '@/lib/trading/buildTokenDeskSharePayload';
import { computeDeskWalletDisplayStats } from '@/lib/trading/deskWalletDisplayStats';
import { readInstantTradeLifetimeStats } from '@/lib/trading/instantTradeStats';
import { useWalletIntelStore } from '@/store/walletIntelStore';
import { useWalletLabelsStore } from '@/store/walletLabels';

export function useTokenDeskSharePnl(params: {
  mint: string;
  decimals: number;
  tokenTicker: string;
  tokenName?: string | null;
  tokenIconUrl?: string | null;
  chain: AppChainId;
  priceUsd?: number | null;
}) {
  const { mint, decimals, tokenTicker, tokenName, tokenIconUrl, chain, priceUsd } = params;
  const { authenticated, getAccessToken } = usePointerAuth();
  const openShare = useWalletIntelStore((s) => s.openShare);

  const myWalletsQ = useQuery({
    queryKey: ['wallets-my'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/wallets/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('wallets');
      const json = (await res.json()) as { wallets: MyWalletRow[] };
      return json;
    },
    enabled: authenticated,
    staleTime: 30_000,
  });

  const { wallet, ready: walletsReady } = useActiveSolanaWallet(myWalletsQ.data?.wallets);

  const labelFromStore = useWalletLabelsStore((s) =>
    wallet?.address ? (s.byAddress[wallet.address]?.label ?? null) : null,
  );

  const { data: balanceData } = useQuery({
    queryKey: ['trade-balance', mint, wallet?.address],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch(
        `/api/trade/balance?mint=${encodeURIComponent(mint)}&wallet=${encodeURIComponent(wallet!.address)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error('balance');
      return (await res.json()) as { rawAmount: string };
    },
    enabled: Boolean(walletsReady && wallet?.address && mint),
    staleTime: 10_000,
  });

  const { data: solUsdRate } = useQuery({
    queryKey: ['portfolio-sol-usd'],
    queryFn: async (): Promise<number | null> => {
      const token = await getAccessToken();
      if (!token) return null;
      const res = await fetch('/api/portfolio?tradesLimit=0&fifoLimit=0', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { solUsd?: number | null };
      const px = json.solUsd;
      return typeof px === 'number' && Number.isFinite(px) && px > 0 ? px : null;
    },
    enabled: authenticated,
    staleTime: 60_000,
  });

  const lifetimeStats = useMemo(() => {
    if (!wallet?.address) return { buyTon: 0, sellTon: 0 };
    return readInstantTradeLifetimeStats(mint, wallet.address);
  }, [mint, wallet?.address, balanceData?.rawAmount]);

  const { data: deskStats } = useDeskWalletStats(mint, wallet?.address);

  const stats = useMemo(
    () =>
      computeDeskWalletDisplayStats({
        session: lifetimeStats,
        desk: deskStats,
        solUsdRate: solUsdRate ?? null,
        priceUsd,
        balanceRaw: balanceData?.rawAmount,
        decimals,
      }),
    [lifetimeStats, deskStats, solUsdRate, priceUsd, balanceData?.rawAmount, decimals],
  );

  const canShare = Boolean(authenticated && wallet?.address && hasTokenDeskShareActivity(stats));

  const openShareComposer = useCallback(() => {
    if (!wallet?.address || !hasTokenDeskShareActivity(stats)) return;
    openShare(
      buildTokenDeskSharePayload({
        walletAddress: wallet.address,
        walletLabel: labelFromStore,
        mint,
        tokenTicker,
        tokenName,
        tokenIconUrl,
        chain,
        stats,
      }),
    );
  }, [
    wallet?.address,
    stats,
    openShare,
    labelFromStore,
    mint,
    tokenTicker,
    tokenName,
    tokenIconUrl,
    chain,
  ]);

  return { canShare, openShareComposer, stats };
}
