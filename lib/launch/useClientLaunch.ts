'use client';

import { useCallback } from 'react';
import { Keypair, VersionedTransaction } from '@solana/web3.js';
import { useSignTransaction, useWallets } from '@privy-io/react-auth/solana';
import { useWallets as useEvmWallets } from '@privy-io/react-auth';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useEmbeddedSolanaAddresses } from '@/lib/hooks/useEmbeddedSolanaAddresses';
import type { EvmClientChain } from '@/lib/launch/deployEvmClient';
import type { LaunchPackageLaunchpad } from '@/lib/launch/types';

/**
 * Client-side Solana launch — deploys from the USER's own wallet (their "main
 * wallet is the deploy wallet"), no server burner key. The server assembles the
 * unsigned pump.fun / bonk create tx (via /api/launch/build), the browser signs
 * it with the fresh mint + the Privy wallet (sign-only), then broadcasts through
 * the private-RPC relay (/api/solana/broadcast) — the same rail spot trades use.
 *
 * Real-money path: verify with a tiny launch before relying on it.
 */

export type ClientLaunchInput = {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string | null;
  twitter?: string | null;
  website?: string | null;
  launchpad: LaunchPackageLaunchpad;
  /** Optional dev buy in SOL. Clamped server-side. */
  devBuyNative?: number;
};

export function useClientLaunch() {
  const { signTransaction } = useSignTransaction();
  const { wallets } = useWallets();
  const { wallets: evmWallets } = useEvmWallets();
  const embedded = useEmbeddedSolanaAddresses();
  const { getAccessToken } = usePointerAuth();

  const deploySol = useCallback(
    async (input: ClientLaunchInput): Promise<{ mint: string; signature: string }> => {
      const wallet = wallets.find((w) => embedded.has(w.address)) ?? wallets[0];
      if (!wallet) throw new Error('No Solana wallet connected');

      const token = await getAccessToken();
      const authHeaders = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const mintKp = Keypair.generate();

      // 1) Server assembles the unsigned create tx for (your wallet + this mint).
      const buildRes = await fetch('/api/launch/build', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: input.name,
          symbol: input.symbol,
          description: input.description,
          imageUrl: input.imageUrl ?? null,
          twitter: input.twitter ?? null,
          website: input.website ?? null,
          chain: 'sol',
          launchpad: input.launchpad,
          ownerAddress: wallet.address,
          mint: mintKp.publicKey.toBase58(),
          devBuyNative: input.devBuyNative ?? 0,
        }),
      });
      const buildJson = (await buildRes.json().catch(() => ({}))) as { serializedTx?: string; error?: string; message?: string };
      if (!buildRes.ok || !buildJson.serializedTx) {
        throw new Error(buildJson.message ?? buildJson.error ?? 'build_failed');
      }

      // 2) Sign: the mint (we own its key) + your wallet (Privy, sign-only).
      const tx = VersionedTransaction.deserialize(Buffer.from(buildJson.serializedTx, 'base64'));
      tx.sign([mintKp]);
      const { signedTransaction } = await signTransaction({
        transaction: tx.serialize(),
        wallet,
        chain: 'solana:mainnet',
      });

      // 3) Broadcast through the private-RPC relay (confirms before returning).
      const bRes = await fetch('/api/solana/broadcast', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ signedTransaction: Buffer.from(signedTransaction).toString('base64'), confirm: true }),
      });
      const bJson = (await bRes.json().catch(() => ({}))) as { signature?: string; error?: string; message?: string };
      if (!bRes.ok || !bJson.signature) {
        throw new Error(bJson.message ?? bJson.error ?? 'broadcast_failed');
      }

      return { mint: mintKp.publicKey.toBase58(), signature: bJson.signature };
    },
    [wallets, embedded, signTransaction, getAccessToken],
  );

  const deployEvm = useCallback(
    async (
      chain: EvmClientChain,
      input: Omit<ClientLaunchInput, 'devBuyNative'>,
    ): Promise<{ tokenAddress: string; txHash: string; explorerUrl: string }> => {
      const wallet = evmWallets.find((w) => w.walletClientType === 'privy') ?? evmWallets[0];
      if (!wallet) throw new Error('No EVM wallet connected');
      const { deployEvmClient, evmClientNeedsMeta } = await import('@/lib/launch/deployEvmClient');

      // Pads like zora/flaunch need server-prepped metadata (JSON URI / base64
      // image) — fetch it first (server-side dodges browser CORS), then deploy.
      let metadataUri: string | null = null;
      let base64Image: string | null = null;
      if (evmClientNeedsMeta(input.launchpad)) {
        const token = await getAccessToken();
        const res = await fetch('/api/launch/evm-meta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            name: input.name,
            symbol: input.symbol,
            description: input.description ?? null,
            imageUrl: input.imageUrl ?? null,
            twitter: input.twitter ?? null,
            website: input.website ?? null,
          }),
        });
        const j = (await res.json().catch(() => ({}))) as { metadataUri?: string | null; base64Image?: string | null; message?: string };
        if (!res.ok) throw new Error(j.message ?? 'metadata_prep_failed');
        metadataUri = j.metadataUri ?? null;
        base64Image = j.base64Image ?? null;
      }

      return deployEvmClient(wallet, chain, {
        name: input.name,
        symbol: input.symbol,
        description: input.description,
        imageUrl: input.imageUrl ?? null,
        twitter: input.twitter ?? null,
        website: input.website ?? null,
        launchpad: input.launchpad,
        metadataUri,
        base64Image,
      });
    },
    [evmWallets, getAccessToken],
  );

  return { deploySol, deployEvm };
}
