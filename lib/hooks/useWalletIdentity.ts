'use client';

import { useMemo } from 'react';
import { appChainForWalletAddress } from '@/lib/chains/walletIntelChain';
import type { MintTopTraderRow } from '@/lib/trading/mintTopTraders';
import { useWalletLabels } from '@/lib/hooks/useWalletLabels';
import { useTrackedWalletsLookup } from '@/lib/hooks/useTrackedWalletsLookup';
import { resolveWalletIdentityCore } from '@/lib/walletIdentity/resolveWalletIdentity';
import { mockWalletWideStats } from '@/lib/walletIdentity/mockWalletWideStats';
import type { WalletIntelBadgeKind } from '@/lib/walletIdentity/types';

/**
 * Lightweight identity bundle for desks that need dossier/header data outside of `WalletIdentityAnchor`.
 */
export function useWalletIdentity(params: {
  address: string;
  truncateLen?: number;
  extras?: WalletIntelBadgeKind[];
  creatorWallet?: string | null;
  topTraderRow?: MintTopTraderRow | null;
}) {
  const { address, truncateLen = 5, extras = [], creatorWallet = null, topTraderRow = null } = params;
  const { resolveLabel } = useWalletLabels();
  const { isTracked } = useTrackedWalletsLookup();

  const labelDisp = resolveLabel(address, truncateLen);
  const tracked = isTracked(address);

  const identity = useMemo(
    () =>
      resolveWalletIdentityCore({
        address,
        chain: appChainForWalletAddress(address),
        labelDisplay: labelDisp ?? null,
        isTracked: tracked,
        extras,
        creatorWallet,
      }),
    [address, labelDisp, tracked, extras, creatorWallet],
  );

  const wide = useMemo(() => mockWalletWideStats(address), [address]);

  return {
    identity,
    labelDisp,
    tracked,
    wideDemo: wide,
    topTraderRow,
  };
}
