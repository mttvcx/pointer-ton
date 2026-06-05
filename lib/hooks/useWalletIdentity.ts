'use client';

import { useMemo } from 'react';
import { appChainForWalletAddress } from '@/lib/chains/walletIntelChain';
import { useUIStore } from '@/store/ui';
import type { MintTopTraderRow } from '@/lib/trading/mintTopTraders';
import { useWalletLabels } from '@/lib/hooks/useWalletLabels';
import { useTrackedWalletsLookup } from '@/lib/hooks/useTrackedWalletsLookup';
import { resolveWalletIdentityCore } from '@/lib/walletIdentity/resolveWalletIdentity';
import { mockWalletWideStats } from '@/lib/walletIdentity/mockWalletWideStats';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';
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
  const uiDemo = useUiDemoMode();
  const activeChain = useUIStore((s) => s.activeChain);

  const labelDisp = resolveLabel(address, truncateLen);
  const tracked = isTracked(address);

  const chain = appChainForWalletAddress(address, activeChain);

  const identity = useMemo(
    () =>
      resolveWalletIdentityCore({
        address,
        chain,
        labelDisplay: labelDisp ?? null,
        isTracked: tracked,
        extras,
        creatorWallet,
        allowDemoDirectory: uiDemo,
      }),
    [address, chain, labelDisp, tracked, extras, creatorWallet, uiDemo],
  );

  const wide = useMemo(
    () => (uiDemo ? mockWalletWideStats(address) : null),
    [address, uiDemo],
  );

  return {
    identity,
    labelDisp,
    tracked,
    wideDemo: wide,
    topTraderRow,
  };
}
