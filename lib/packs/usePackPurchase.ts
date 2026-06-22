'use client';

import { useCallback } from 'react';
import { useSignTransaction, useWallets } from '@privy-io/react-auth/solana';
import { useActiveWalletStore } from '@/store/activeWallet';

function bytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64FromBytes(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

/**
 * Live pack commerce client flow:
 *  1. /api/packs/pay builds the unsigned SOL transfer to the treasury.
 *  2. The user's ACTIVE Pointer wallet SIGNS it (Privy, sign-only).
 *  3. /api/packs/pay-broadcast relays it through the server's private Helius RPC
 *     (the public client RPC rejects sends → Solana #8100002, and a client-side
 *     Helius key would expose credits). Returns the on-chain signature.
 *  4. /api/packs/open verifies that signature paid the treasury.
 */
export function usePackPurchase() {
  const { signTransaction } = useSignTransaction();
  const { wallets } = useWallets();
  const activeAddress = useActiveWalletStore((s) => s.activeWalletAddress);

  const payForPack = useCallback(
    async (opts: {
      packType: string;
      getAccessToken: () => Promise<string | null>;
    }): Promise<{ paymentTx: string; userWallet: string }> => {
      // Sign with the user's ACTIVE Pointer wallet (same selection as trading),
      // never wallets[0] which can be an external/non-active wallet.
      const wallet =
        (activeAddress ? wallets.find((w) => w.address === activeAddress) : undefined) ??
        wallets[0];
      if (!wallet) throw new Error('No Solana wallet connected');
      const userWallet = wallet.address;

      const token = await opts.getAccessToken();
      if (!token) throw new Error('no_token');

      // 1. Build the unsigned transfer.
      const res = await fetch('/api/packs/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packType: opts.packType, userWallet }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        paymentTransaction?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok || !json.paymentTransaction) {
        throw new Error(json.message ?? json.error ?? 'pay_quote_failed');
      }

      // 2. Sign (no broadcast).
      const { signedTransaction } = await signTransaction({
        transaction: bytesFromBase64(json.paymentTransaction),
        wallet,
        chain: 'solana:mainnet',
      });

      // 3. Broadcast server-side through the private Helius RPC.
      const bRes = await fetch('/api/packs/pay-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ signedTransaction: base64FromBytes(signedTransaction) }),
      });
      const bJson = (await bRes.json().catch(() => ({}))) as {
        signature?: string;
        error?: string;
      };
      if (!bRes.ok || !bJson.signature) {
        throw new Error(bJson.error ?? 'broadcast_failed');
      }

      return { paymentTx: bJson.signature, userWallet };
    },
    [wallets, signTransaction, activeAddress],
  );

  return { payForPack };
}
