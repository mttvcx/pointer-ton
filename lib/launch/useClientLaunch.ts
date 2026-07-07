'use client';

import { useCallback } from 'react';
import { Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { useSignTransaction, useWallets } from '@privy-io/react-auth/solana';
import { useWallets as useEvmWallets } from '@privy-io/react-auth';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useEmbeddedSolanaAddresses } from '@/lib/hooks/useEmbeddedSolanaAddresses';
import { useXMonitorSettings } from '@/store/xMonitorSettings';
import type { EvmClientChain } from '@/lib/launch/deployEvmClient';
import type { LaunchPackageLaunchpad } from '@/lib/launch/types';

/**
 * Client-side launch — deploys from the wallet the user SELECTED in the launch /
 * X-Monitor settings (`deployWallet`), or a pasted custom wallet key
 * (`deployWalletKey`), else their main connected wallet. NEVER a shared server
 * burner. The server only assembles the unsigned pump.fun / bonk create tx (via
 * /api/launch/build); the browser signs (mint + the chosen wallet) and broadcasts
 * through the private-RPC relay — the same rail spot trades use.
 *
 * Real-money path: verify with a tiny launch before relying on it.
 */

/** Build a Solana Keypair from a base58 / hex / json-array secret. */
function keypairFromSecret(secret: string): Keypair {
  const s = secret.trim();
  if (s.startsWith('[')) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(s) as number[]));
  const bytes = bs58.decode(s);
  return bytes.length === 32 ? Keypair.fromSeed(bytes) : Keypair.fromSecretKey(bytes);
}

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
  // The wallet the user chose to deploy from (address), or a pasted custom key.
  const deployWallet = useXMonitorSettings((s) => s.deployWallet);
  const deployWalletKey = useXMonitorSettings((s) => s.deployWalletKey);

  const deploySol = useCallback(
    async (input: ClientLaunchInput): Promise<{ mint: string; signature: string }> => {
      // Resolve the deploy signer from the wallet selector:
      //  1) a pasted custom wallet key  → sign locally with that keypair
      //  2) the selected Privy wallet (deployWallet address)
      //  3) fall back to the main / first connected wallet
      const customKp = deployWalletKey ? keypairFromSecret(deployWalletKey) : null;
      const selected = deployWallet ? wallets.find((w) => w.address === deployWallet) : null;
      const privyWallet = selected ?? wallets.find((w) => embedded.has(w.address)) ?? wallets[0];
      const ownerAddress = customKp ? customKp.publicKey.toBase58() : privyWallet?.address;
      if (!ownerAddress) throw new Error('No deploy wallet — connect one or pick it in launch settings.');

      const token = await getAccessToken();
      const authHeaders = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const mintKp = Keypair.generate();

      // 1) Server assembles the unsigned create tx for (the chosen wallet + this mint).
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
          ownerAddress,
          mint: mintKp.publicKey.toBase58(),
          devBuyNative: input.devBuyNative ?? 0,
        }),
      });
      const buildJson = (await buildRes.json().catch(() => ({}))) as { serializedTx?: string; error?: string; message?: string };
      if (!buildRes.ok || !buildJson.serializedTx) {
        throw new Error(buildJson.message ?? buildJson.error ?? 'build_failed');
      }

      // 2) Sign: the mint (we own its key) + the chosen deploy wallet.
      const tx = VersionedTransaction.deserialize(Buffer.from(buildJson.serializedTx, 'base64'));
      tx.sign([mintKp]);
      let signedBytes: Uint8Array;
      if (customKp) {
        // Pasted custom wallet — sign locally (it's the fee-payer too).
        tx.sign([customKp]);
        signedBytes = tx.serialize();
      } else {
        if (!privyWallet) throw new Error('No Solana wallet connected');
        const { signedTransaction } = await signTransaction({
          transaction: tx.serialize(),
          wallet: privyWallet,
          chain: 'solana:mainnet',
        });
        signedBytes = signedTransaction;
      }

      // 3) Broadcast through the private-RPC relay (confirms before returning).
      const bRes = await fetch('/api/solana/broadcast', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ signedTransaction: Buffer.from(signedBytes).toString('base64'), confirm: true }),
      });
      const bJson = (await bRes.json().catch(() => ({}))) as { signature?: string; error?: string; message?: string };
      if (!bRes.ok || !bJson.signature) {
        throw new Error(bJson.message ?? bJson.error ?? 'broadcast_failed');
      }

      return { mint: mintKp.publicKey.toBase58(), signature: bJson.signature };
    },
    [wallets, embedded, signTransaction, getAccessToken, deployWallet, deployWalletKey],
  );

  const deployEvm = useCallback(
    async (
      chain: EvmClientChain,
      input: Omit<ClientLaunchInput, 'devBuyNative'>,
    ): Promise<{ tokenAddress: string; txHash: string; explorerUrl: string }> => {
      // Prefer the wallet the user selected to deploy from; else main/first EVM wallet.
      const selectedEvm = deployWallet
        ? evmWallets.find((w) => w.address.toLowerCase() === deployWallet.toLowerCase())
        : null;
      const wallet = selectedEvm ?? evmWallets.find((w) => w.walletClientType === 'privy') ?? evmWallets[0];
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
    [evmWallets, getAccessToken, deployWallet],
  );

  return { deploySol, deployEvm };
}
