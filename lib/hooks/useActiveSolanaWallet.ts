'use client';

import { useEffect, useMemo } from 'react';
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

  const privySet = useMemo(() => new Set(wallets.map((w) => w.address)), [wallets]);

  const wallet = useMemo(() => {
    if (!linkedTonAddress) return null;
    if (!activeAddr) return wallets[0] ?? null;
    return wallets.find((w) => w.address === activeAddr) ?? wallets[0] ?? null;
  }, [wallets, activeAddr, linkedTonAddress]);

  useEffect(() => {
    if (!authReady || wallets.length === 0) return;
    const firstPrivy = wallets[0]!.address;

    if (myWallets === undefined) {
      if (!activeAddr || !privySet.has(activeAddr)) {
        setActive(firstPrivy);
      }
      return;
    }

    const eligible = myWallets.filter((r) => {
      if (r.is_archived || !r.is_active) return false;
      const row = normalizeTonAddress(r.wallet_address);
      return Boolean(row && linkedTonAddress && row === linkedTonAddress);
    });
    const tradingEligible = eligible.filter((r) => !r.is_imported);
    const pickList = tradingEligible.length > 0 ? tradingEligible : eligible;

    if (pickList.length === 0) {
      if (!activeAddr || !privySet.has(activeAddr)) {
        setActive(firstPrivy);
      }
      return;
    }

    const eligibleSet = new Set(
      pickList.map((r) => normalizeTonAddress(r.wallet_address)).filter(Boolean) as string[],
    );
    const activeNorm = activeAddr ? normalizeTonAddress(activeAddr) : null;
    if (activeNorm && eligibleSet.has(activeNorm)) {
      return;
    }

    const primary = pickList.find((r) => r.is_primary);
    setActive((primary ?? pickList[0]!).wallet_address);
  }, [authReady, wallets, myWallets, activeAddr, privySet, setActive, linkedTonAddress]);

  return {
    wallet,
    wallets,
    ready: authReady,
    activeAddress: wallet?.address ?? null,
    setActiveWalletAddress: setActive,
  };
}
