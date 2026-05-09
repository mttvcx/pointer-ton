'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useActiveWalletStore } from '@/store/activeWallet';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

export type MyWalletRow = {
  id: string;
  label: string | null;
  wallet_address: string;
  is_primary: boolean;
  slot: number;
  is_archived: boolean;
  is_active: boolean;
  is_imported?: boolean;
  balance_lamports: string | null;
  balance_updated_at: string | null;
  created_at: string;
};

/**
 * Active TON wallet for the session (TonConnect). Kept name for minimal churn
 * across trading / portfolio components. Rename to useActiveTonWallet when convenient.
 */
export function useActiveSolanaWallet(myWallets: MyWalletRow[] | undefined) {
  const { linkedTonAddress, ready: authReady } = usePointerAuth();
  const activeAddr = useActiveWalletStore((s) => s.activeWalletAddress);
  const setActive = useActiveWalletStore((s) => s.setActiveWalletAddress);

  const wallets = useMemo(
    () => (linkedTonAddress ? [{ address: linkedTonAddress }] : []),
    [linkedTonAddress],
  );

  /** Normalized TON addresses the session can sign for (TonConnect-linked). */
  const signableNormalized = useMemo(() => {
    const s = new Set<string>();
    if (linkedTonAddress) {
      const n = normalizeTonAddress(linkedTonAddress);
      if (n) s.add(n);
    }
    return s;
  }, [linkedTonAddress]);

  const eligibleRows = useMemo(() => {
    if (!myWallets?.length) return [];
    return myWallets.filter((r) => r.is_active && !r.is_archived);
  }, [myWallets]);

  const eligibleNormToRaw = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of eligibleRows) {
      const n = normalizeTonAddress(r.wallet_address);
      if (n) m.set(n, r.wallet_address);
    }
    return m;
  }, [eligibleRows]);

  const wallet = useMemo(() => {
    if (!activeAddr) return null;
    return { address: activeAddr };
  }, [activeAddr]);

  const canSignWithWallet = useCallback(
    (address: string) => {
      const n = normalizeTonAddress(address);
      return n != null && signableNormalized.has(n);
    },
    [signableNormalized],
  );

  useEffect(() => {
    if (!authReady) return;

    if (myWallets === undefined) {
      if (linkedTonAddress && !activeAddr) {
        setActive(linkedTonAddress);
      }
      return;
    }

    if (eligibleRows.length === 0) {
      if (linkedTonAddress) {
        const n = normalizeTonAddress(linkedTonAddress);
        const activeNorm = activeAddr ? normalizeTonAddress(activeAddr) : null;
        if (n && activeNorm !== n) {
          setActive(linkedTonAddress);
        }
      }
      return;
    }

    const activeNorm = activeAddr ? normalizeTonAddress(activeAddr) : null;
    if (activeNorm && eligibleNormToRaw.has(activeNorm)) {
      return;
    }

    const primary = eligibleRows.find((r) => r.is_primary);
    setActive((primary ?? eligibleRows[0]!).wallet_address);
  }, [authReady, myWallets, eligibleRows, eligibleNormToRaw, activeAddr, setActive, linkedTonAddress]);

  return {
    wallet,
    wallets,
    ready: authReady,
    activeAddress: activeAddr ?? null,
    setActiveWalletAddress: setActive,
    canSignWithWallet,
  };
}
