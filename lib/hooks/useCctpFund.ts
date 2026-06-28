'use client';

import { useCallback, useMemo, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { useSignTransaction, useWallets } from '@privy-io/react-auth/solana';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useEmbeddedSolanaAddresses } from '@/lib/hooks/useEmbeddedSolanaAddresses';
import { getClientSolanaRpcUrls } from '@/lib/solana/clientRpcUrl';
import { buildCctpDepositTx } from '@/lib/hyperliquid/cctpBurn';

export type CctpFundState = 'idle' | 'signing' | 'bridging' | 'done' | 'error';

/**
 * One-tap "fund Hyperliquid from your Solana balance": burn USDC on Solana via
 * CCTP (mint to your EVM address on HyperEVM). Signs with the Privy Solana wallet
 * (sign-only) and broadcasts through the same private-RPC rail as spot trades.
 *
 * UNTESTED until a real transfer — the burn tx signature it returns feeds
 * `/api/perps/cctp/attestation`. Worst case of a bug is a failed tx (no loss),
 * since the destination domain + recipient are locked.
 */
export function useCctpFund() {
  const { signTransaction } = useSignTransaction();
  const { wallets } = useWallets();
  const embedded = useEmbeddedSolanaAddresses();
  const { getAccessToken } = usePointerAuth();

  const [state, setState] = useState<CctpFundState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [burnSig, setBurnSig] = useState<string | null>(null);

  const solanaAddress = useMemo(
    () => wallets.find((w) => embedded.has(w.address))?.address ?? wallets[0]?.address ?? null,
    [wallets, embedded],
  );

  const fund = useCallback(
    async (amountUsdc: number, evmRecipient: string): Promise<string | null> => {
      setError(null);
      setBurnSig(null);
      const wallet = wallets.find((w) => embedded.has(w.address)) ?? wallets[0];
      if (!wallet) {
        setError('No Solana wallet to bridge from');
        setState('error');
        return null;
      }
      try {
        setState('signing');
        const connection = new Connection(getClientSolanaRpcUrls().http, 'confirmed');
        const owner = new PublicKey(wallet.address);
        const { transaction } = await buildCctpDepositTx({ connection, owner, amountUsdc, evmRecipient });
        const serialized = transaction.serialize({ requireAllSignatures: false });

        const { signedTransaction } = await signTransaction({
          transaction: serialized,
          wallet,
          chain: 'solana:mainnet',
        });

        setState('bridging');
        const token = await getAccessToken();
        const res = await fetch('/api/solana/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            signedTransaction: Buffer.from(signedTransaction).toString('base64'),
            confirm: true,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          signature?: string;
          error?: string;
          message?: string;
        };
        if (!res.ok || !json.signature) {
          throw new Error(json.message ?? json.error ?? 'broadcast_failed');
        }
        setBurnSig(json.signature);
        setState('done');
        return json.signature;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'fund_failed');
        setState('error');
        return null;
      }
    },
    [wallets, embedded, signTransaction, getAccessToken],
  );

  return { fund, state, error, burnSig, solanaAddress, reset: () => setState('idle') };
}
