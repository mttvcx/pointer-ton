'use client';

import { useCallback } from 'react';
import bs58 from 'bs58';
import { useSignAndSendTransaction, useWallets } from '@privy-io/react-auth/solana';
import { useActiveWalletStore } from '@/store/activeWallet';

function bytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Live pack commerce client flow: ask the server to build the pack-price
 * transfer to the treasury, have the user's Privy wallet sign + send it, and
 * return the signature for /api/packs/open to verify. Mirrors the trade
 * quote→sign→execute split (see {@link usePointerTradeSubmit}).
 */
export function usePackPurchase() {
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { wallets } = useWallets();
  const activeAddress = useActiveWalletStore((s) => s.activeWalletAddress);

  const payForPack = useCallback(
    async (opts: {
      packType: string;
      getAccessToken: () => Promise<string | null>;
    }): Promise<{ paymentTx: string; userWallet: string }> => {
      // Charge + sign with the user's ACTIVE Pointer wallet — the same selection
      // trading uses (usePointerTradeSubmit). Never wallets[0]: that can be an
      // external/Phantom or non-active wallet, which routes through the wrong send
      // path and HTTP-errors (Solana #8100002). Routes through Pointer regardless
      // of login method.
      const wallet =
        (activeAddress ? wallets.find((w) => w.address === activeAddress) : undefined) ??
        wallets[0];
      if (!wallet) throw new Error('No Solana wallet connected');
      const userWallet = wallet.address;

      const token = await opts.getAccessToken();
      if (!token) throw new Error('no_token');

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

      const { signature } = await signAndSendTransaction({
        transaction: bytesFromBase64(json.paymentTransaction),
        wallet,
        chain: 'solana:mainnet',
      });

      return { paymentTx: bs58.encode(signature), userWallet };
    },
    [wallets, signAndSendTransaction, activeAddress],
  );

  return { payForPack };
}
