'use client';

import { Address, beginCell, storeStateInit, toNano, type Sender, type SenderArguments } from '@ton/core';
import type { TonConnectUI } from '@tonconnect/ui-react';

/**
 * TON Jetton launch — deploys a standard TEP-74 Jetton from the user's own
 * TonConnect wallet (their "main wallet is the deploy wallet"). Uses the
 * maintained @ton-community/assets-sdk, so the minter/wallet contract code is
 * the verified standard (no hand-authored BOCs). On-chain metadata (name /
 * symbol / image), so no external pinning is needed.
 *
 * NOTE: real on-chain deploy — verify on TON testnet before relying on mainnet.
 * The SDK + this adapter are dynamically imported so they never weigh down the
 * main bundle.
 */

const DEFAULT_SUPPLY = 1_000_000_000n; // 1B jettons, mirrors the Solana default
const JETTON_DECIMALS = 9;

/** Wrap a TonConnect UI as an @ton/core Sender so the assets-sdk can drive it. */
function tonConnectSender(tonConnectUI: TonConnectUI, owner: Address): Sender {
  return {
    address: owner,
    send: async (args: SenderArguments) => {
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [
          {
            address: args.to.toString(),
            amount: args.value.toString(),
            stateInit: args.init
              ? beginCell().store(storeStateInit(args.init)).endCell().toBoc().toString('base64')
              : undefined,
            payload: args.body ? args.body.toBoc().toString('base64') : undefined,
          },
        ],
      });
    },
  };
}

export type DeployTonJettonInput = {
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string | null;
  ownerAddress: string;
  /** Whole-token supply preminted to the owner (default 1B). */
  supply?: number;
};

export async function deployTonJetton(
  tonConnectUI: TonConnectUI,
  input: DeployTonJettonInput,
): Promise<{ jettonAddress: string }> {
  // Dynamic import — heavy TON SDK stays out of the main bundle.
  const { AssetsSDK, createApi } = await import('@ton-community/assets-sdk');

  const owner = Address.parse(input.ownerAddress);
  const api = await createApi('mainnet');
  const sdk = AssetsSDK.create({ api, sender: tonConnectSender(tonConnectUI, owner) });

  const supply = BigInt(Math.max(1, Math.floor(input.supply ?? Number(DEFAULT_SUPPLY))));
  const premintAmount = supply * 10n ** BigInt(JETTON_DECIMALS);

  const jetton = await sdk.deployJetton(
    {
      name: input.name,
      symbol: input.symbol.replace(/^\$/, '').toUpperCase(),
      description: input.description ?? '',
      image: input.imageUrl ?? undefined,
      decimals: JETTON_DECIMALS,
    },
    {
      onchainContent: true,
      adminAddress: owner,
      premintAmount,
      value: toNano('0.25'), // deploy + storage + mint gas
    },
  );

  return { jettonAddress: jetton.address.toString() };
}
