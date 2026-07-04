import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';
import { SOL_MINT, USDC_MINT } from '@/lib/utils/addresses';

export type ConvertAssetId = 'SOL' | 'USDC' | 'BNB' | 'ETH' | 'HLUSDC';

/** USDC on Hyperliquid — a convert TARGET only; routes through Circle CCTP, not LI.FI/Jupiter. */
export function isHyperliquidUsdc(id: ConvertAssetId): boolean {
  return id === 'HLUSDC';
}

export type ConvertAssetMeta = {
  id: ConvertAssetId;
  label: string;
  decimals: number;
  iconSrc: string;
  /** LI.FI chain key or id */
  lifiChain: string;
  /** LI.FI token symbol or mint/address */
  lifiToken: string;
  /** Solana SPL mint when applicable */
  solMint?: string;
};

export const CONVERT_ASSETS: ConvertAssetMeta[] = [
  {
    id: 'SOL',
    label: 'SOL',
    decimals: 9,
    iconSrc: CHAIN_ICON_PNG.sol,
    lifiChain: 'SOL',
    lifiToken: '11111111111111111111111111111111',
    solMint: SOL_MINT,
  },
  {
    id: 'USDC',
    label: 'USDC',
    decimals: 6,
    iconSrc: '/logos/protocols/usdc.png',
    lifiChain: 'SOL',
    lifiToken: USDC_MINT,
    solMint: USDC_MINT,
  },
  {
    id: 'BNB',
    label: 'BNB',
    decimals: 18,
    iconSrc: CHAIN_ICON_PNG.bnb,
    lifiChain: 'BSC',
    lifiToken: 'BNB',
  },
  {
    id: 'ETH',
    label: 'ETH',
    decimals: 18,
    iconSrc: CHAIN_ICON_PNG.eth,
    lifiChain: 'ETH',
    lifiToken: 'ETH',
  },
  {
    // Target-only: "convert" USDC on Solana to USDC on Hyperliquid via Circle CCTP.
    // Short label — the Hyperliquid badge on the icon conveys the destination.
    id: 'HLUSDC',
    label: 'USDC',
    decimals: 6,
    iconSrc: '/logos/protocols/usdc.png',
    lifiChain: 'SOL',
    lifiToken: USDC_MINT,
    solMint: USDC_MINT,
  },
];

/** Assets that can be the FROM side (HLUSDC is a destination only). */
export const CONVERT_FROM_ASSETS: ConvertAssetMeta[] = CONVERT_ASSETS.filter((a) => a.id !== 'HLUSDC');

const BY_ID = new Map(CONVERT_ASSETS.map((a) => [a.id, a]));

export function convertAssetById(id: ConvertAssetId): ConvertAssetMeta {
  const hit = BY_ID.get(id);
  if (!hit) throw new Error(`unknown_convert_asset:${id}`);
  return hit;
}

export function defaultConvertFromAsset(chain: AppChainId): ConvertAssetId {
  if (chain === 'bnb') return 'BNB';
  if (chain === 'eth' || chain === 'base') return 'ETH';
  return 'SOL';
}

export function defaultConvertToAsset(from: ConvertAssetId): ConvertAssetId {
  if (from === 'SOL') return 'BNB';
  if (from === 'BNB') return 'SOL';
  if (from === 'USDC') return 'SOL';
  return 'USDC';
}

export function isSolanaJupiterSwap(from: ConvertAssetMeta, to: ConvertAssetMeta): boolean {
  return from.lifiChain === 'SOL' && to.lifiChain === 'SOL';
}

export function uiAmountToRaw(ui: number, decimals: number): string {
  if (!Number.isFinite(ui) || ui <= 0) return '0';
  const factor = 10 ** decimals;
  const raw = Math.floor(ui * factor + 1e-9);
  return String(raw);
}

export function rawAmountToUi(raw: string, decimals: number): number {
  try {
    const n = BigInt(raw);
    return Number(n) / 10 ** decimals;
  } catch {
    return 0;
  }
}
