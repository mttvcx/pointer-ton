import type { AppChainId } from '@/lib/chains/appChain';

export type StarterWalletEntry = {
  address: string;
  label: string;
};

export type StarterWalletPack = {
  chain: AppChainId;
  label: string;
  slug: string;
  sortOrder: number;
  wallets: StarterWalletEntry[];
};

/**
 * Curated starter watchlists — placeholder wallets until ops replaces with live picks.
 * Seeded once per user on first auth sync.
 */
export const STARTER_WALLET_PACKS: StarterWalletPack[] = [
  {
    chain: 'sol',
    label: 'Best SOL',
    slug: 'starter:sol',
    sortOrder: 0,
    wallets: [
      { address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', label: 'sanuxo' },
      { address: 'GThUX1Atox4Ykr68x6dzNChemUoK16z9bAQjyGQeM2dT', label: 'Apex desk' },
      { address: '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S', label: 'Insider desk' },
      { address: 'CenNtDkUuZUV2T36rFq2EMEa6Wk3aouREJFqJa3Yk1iB', label: 'Sniper lane' },
      { address: '7K1WgKQgDzH9H3WR8QjmN8KqVn1YJgZxYzPLFToK9mNp', label: 'Deployer cohort' },
    ],
  },
  {
    chain: 'bnb',
    label: 'Best BNB',
    slug: 'starter:bnb',
    sortOrder: 1,
    wallets: [
      { address: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045', label: 'vitalik.eth' },
      { address: '0x8894e0a0c962cb723c1976a4421c95949be2d4e3', label: 'Binance hot' },
      { address: '0x28c6c06298d514db089934071355e5743bf21d60', label: 'Binance 14' },
      { address: '0x21a31ee1afc51d94c2e590ca6e3e276775316937', label: 'Binance 15' },
      { address: '0xdf3f325fe8f2658db268114579f6f2d608b525ba', label: 'Four.meme desk' },
    ],
  },
  {
    chain: 'base',
    label: 'Best Base',
    slug: 'starter:base',
    sortOrder: 2,
    wallets: [
      { address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', label: 'USDC vault' },
      { address: '0x4200000000000000000000000000000000000006', label: 'WETH rail' },
      { address: '0x7777777777777777777777777777777777777771', label: 'vie.dev' },
      { address: '0x7777777777777777777777777777777777777772', label: 'L token desk' },
      { address: '0x7777777777777777777777777777777777777773', label: 'Freedom desk' },
    ],
  },
  {
    chain: 'ton',
    label: 'Best TON',
    slug: 'starter:ton',
    sortOrder: 3,
    wallets: [
      { address: 'EQDXWFihDsLUEJM5z2HPiFxjxBKvZuLcuY9alCu00i7vJaZa', label: 'Ozark' },
      { address: 'EQBMPsBatosg8z8WFMAm4IKzzk9oNVDjVINaZJgKL7UKBphA', label: 'Cupsey' },
      { address: 'EQBPauSJUSd-lRxePlW-S3wxb1m4ZilvBFTaeytfMqmBj84c', label: 'Kadenox' },
      { address: 'EQCGECIaOBhYcTj77EqQmVC5qupOS2iJ7Ixzfj-tp0dPd2I8', label: '1simple' },
      { address: 'EQDSsGG5WYliTh4n7bDKANc-mCqrHwsCJSr-oRNOe-xN49q1', label: 'LimoonLambo' },
    ],
  },
];
