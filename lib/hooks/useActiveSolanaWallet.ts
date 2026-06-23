'use client';

import { useCallback, useEffect, useMemo } from 'react';
import bs58 from 'bs58';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useActiveWalletStore } from '@/store/activeWallet';
import type { AppChainId } from '@/lib/chains/appChain';
import { mintMatchesAppChain } from '@/lib/chains/mintKind';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';
import { useUIStore } from '@/store/ui';

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

function canonicalWalletKey(address: string, chain: AppChainId): string | null {
  const raw = address.trim();
  if (!mintMatchesAppChain(raw, chain)) return null;
  if (chain === 'ton') return normalizeTonAddress(raw);
  if (chain === 'sol') {
    // Canonicalize via bs58 (decode → 32-byte check → re-encode) instead of
    // @solana/web3.js PublicKey, so this shell-mounted hook does not drag the
    // 14MB web3.js bundle onto the cold-load critical path.
    try {
      const bytes = bs58.decode(raw);
      if (bytes.length !== 32) return null;
      return bs58.encode(bytes);
    } catch {
      return null;
    }
  }
  if (chain === 'bnb' || chain === 'base') {
    const lo = raw.toLowerCase();
    if (/^0x[a-f0-9]{40}$/.test(lo)) return lo;
  }
  return null;
}

/**
 * Active wallet for the selected app chain (header toggle). TON rows use TonConnect for signing.
 */
export function useActiveSolanaWallet(myWallets: MyWalletRow[] | undefined) {
  const activeChain = useUIStore((s) => s.activeChain);
  const { linkedTonAddress, ready: authReady } = usePointerAuth();
  const activeAddr = useActiveWalletStore((s) => s.activeWalletAddress);
  const manuallyPicked = useActiveWalletStore((s) => s.manuallyPicked);
  const setActive = useActiveWalletStore((s) => s.setActiveWalletAddress);

  const wallets = useMemo(
    () => (linkedTonAddress ? [{ address: linkedTonAddress }] : []),
    [linkedTonAddress],
  );

  const signableNormalized = useMemo(() => {
    const s = new Set<string>();
    if (activeChain === 'ton' && linkedTonAddress) {
      const n = normalizeTonAddress(linkedTonAddress);
      if (n) s.add(n);
    }
    return s;
  }, [activeChain, linkedTonAddress]);

  const eligibleRows = useMemo(() => {
    if (!myWallets?.length) return [];
    return myWallets.filter(
      (r) =>
        r.is_active &&
        !r.is_archived &&
        mintMatchesAppChain(r.wallet_address, activeChain),
    );
  }, [myWallets, activeChain]);

  const eligibleKeyToRaw = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of eligibleRows) {
      const k = canonicalWalletKey(r.wallet_address, activeChain);
      if (k) m.set(k, r.wallet_address);
    }
    return m;
  }, [eligibleRows, activeChain]);

  const wallet = useMemo(() => {
    if (!activeAddr) return null;
    return { address: activeAddr };
  }, [activeAddr]);

  const canSignWithWallet = useCallback(
    (address: string) => {
      if (activeChain !== 'ton') return false;
      const n = normalizeTonAddress(address);
      return n != null && signableNormalized.has(n);
    },
    [activeChain, signableNormalized],
  );

  useEffect(() => {
    if (!authReady) return;

    if (myWallets === undefined) {
      if (activeChain === 'ton' && linkedTonAddress && !activeAddr) {
        setActive(linkedTonAddress);
      } else if (activeAddr && canonicalWalletKey(activeAddr, activeChain) == null) {
        // Drop persisted chain-mismatch (e.g. TON address while header is SOL) before list loads.
        setActive(null);
      }
      return;
    }

    if (eligibleRows.length === 0) {
      if (activeChain === 'ton' && linkedTonAddress) {
        const n = normalizeTonAddress(linkedTonAddress);
        const activeNorm = activeAddr ? normalizeTonAddress(activeAddr) : null;
        if (n && activeNorm !== n) {
          setActive(linkedTonAddress);
        }
        return;
      }
      if (activeAddr) setActive(null);
      return;
    }

    const activeKey = activeAddr ? canonicalWalletKey(activeAddr, activeChain) : null;
    if (activeKey && eligibleKeyToRaw.has(activeKey)) {
      // Keep a deliberate user pick, or the primary itself. Otherwise prefer the
      // primary so the header/top-right defaults to the main funded wallet (a
      // non-primary that was only auto-selected — e.g. while primary was
      // archived — should not stay sticky).
      const activeRow = eligibleRows.find(
        (r) => canonicalWalletKey(r.wallet_address, activeChain) === activeKey,
      );
      if (manuallyPicked || activeRow?.is_primary) return;
      const primaryRow = eligibleRows.find((r) => r.is_primary);
      if (
        primaryRow &&
        canonicalWalletKey(primaryRow.wallet_address, activeChain) !== activeKey
      ) {
        setActive(primaryRow.wallet_address);
      }
      return;
    }

    const primary = eligibleRows.find((r) => r.is_primary);
    setActive((primary ?? eligibleRows[0]!).wallet_address);
  }, [
    authReady,
    myWallets,
    eligibleRows,
    eligibleKeyToRaw,
    activeAddr,
    manuallyPicked,
    setActive,
    linkedTonAddress,
    activeChain,
  ]);

  return {
    wallet,
    wallets,
    ready: authReady,
    activeAddress: activeAddr ?? null,
    setActiveWalletAddress: setActive,
    canSignWithWallet,
    activeChain,
  };
}
