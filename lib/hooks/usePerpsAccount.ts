'use client';

import { useMemo } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { useQuery } from '@tanstack/react-query';

export type PerpsPosition = {
  coin: string;
  szi: number;
  entryPx: number | null;
  positionValue: number | null;
  unrealizedPnl: number | null;
  liquidationPx: number | null;
  marginUsed: number | null;
  leverage: number | null;
};

export type PerpsAccount = {
  accountValue: number;
  withdrawable: number;
  totalMarginUsed: number;
  positions: PerpsPosition[];
};

/** The user's Hyperliquid account address — their Privy embedded EVM wallet. */
export function usePerpsEvmAddress(): string | null {
  const { wallets } = useWallets();
  return useMemo(() => {
    const embedded = wallets.find((w) => w.walletClientType === 'privy');
    return (embedded ?? wallets[0])?.address ?? null;
  }, [wallets]);
}

/** Live HL account state (margin + positions). Polls while the terminal is open. */
export function usePerpsAccount() {
  const address = usePerpsEvmAddress();
  const q = useQuery({
    queryKey: ['perps-account', address],
    queryFn: async (): Promise<PerpsAccount> => {
      const res = await fetch(`/api/perps/account?address=${encodeURIComponent(address ?? '')}`);
      if (!res.ok) throw new Error(`perps_account_${res.status}`);
      return (await res.json()) as PerpsAccount;
    },
    enabled: Boolean(address),
    refetchInterval: 8000,
    staleTime: 5000,
  });
  return { address, account: q.data ?? null, isLoading: q.isLoading && Boolean(address) };
}
