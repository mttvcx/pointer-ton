import { USDC_DECIMALS } from '@/lib/utils/constants';
import { USDC_MINT } from '@/lib/utils/addresses';
import { uiToRaw } from '@/lib/utils/formatters';

/** Spend asset for Solana spot buys (uSOL later). */
export type SolSpendAsset = 'sol' | 'usdc';

export { USDC_MINT };

export function usdcToRaw(usdc: number): bigint {
  if (!Number.isFinite(usdc) || usdc <= 0) return 0n;
  return uiToRaw(usdc, USDC_DECIMALS);
}

export function spendAssetLabel(asset: SolSpendAsset): string {
  return asset === 'usdc' ? 'USDC' : 'SOL';
}

export type BuyQuoteAmountFields =
  | { amountSol: number; amountUsdc?: never }
  | { amountUsdc: number; amountSol?: never };

export function buyQuoteAmountFields(
  asset: SolSpendAsset,
  amount: number,
): BuyQuoteAmountFields {
  if (asset === 'usdc') return { amountUsdc: amount };
  return { amountSol: amount };
}
