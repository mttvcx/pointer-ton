import 'server-only';

import {
  convertAssetById,
  isSolanaJupiterSwap,
  rawAmountToUi,
  uiAmountToRaw,
  type ConvertAssetId,
} from '@/lib/exchange/convertAssets';
import { fetchLifiQuote, lifiSolanaTransactionBase64 } from '@/lib/bridge/lifi';
import { getQuote } from '@/lib/jupiter/quote';
import { getSwapTx } from '@/lib/jupiter/swap';
import { inferMintKind } from '@/lib/chains/mintKind';
import type { UserWalletRow } from '@/lib/db/userWallets';

export type ConvertQuoteInput = {
  userId: string;
  fromAsset: ConvertAssetId;
  toAsset: ConvertAssetId;
  amountUi: number;
  fromAddress: string;
  wallets: UserWalletRow[];
};

export type ConvertQuoteResult = {
  provider: 'jupiter' | 'lifi';
  fromAsset: ConvertAssetId;
  toAsset: ConvertAssetId;
  fromAmountUi: number;
  toAmountUi: number;
  toAmountMinUi: number | null;
  rateLabel: string;
  transaction: string | null;
  tool: string | null;
};

function pickWalletForLifiChain(
  wallets: UserWalletRow[],
  lifiChain: string,
): string | null {
  const active = wallets.filter((w) => w.is_active && !w.is_archived);
  if (lifiChain === 'SOL') {
    return active.find((w) => inferMintKind(w.wallet_address) === 'sol')?.wallet_address ?? null;
  }
  if (lifiChain === 'BSC' || lifiChain === 'ETH' || lifiChain === 'BAS' || lifiChain === 'POL') {
    return active.find((w) => inferMintKind(w.wallet_address) === 'evm')?.wallet_address ?? null;
  }
  return null;
}

function formatRateLabel(fromSym: string, toSym: string, rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return `1 ${fromSym} ≈ — ${toSym}`;
  const abs = Math.abs(rate);
  const decimals = abs >= 1 ? 4 : abs >= 0.01 ? 6 : 8;
  return `1 ${fromSym} ≈ ${rate.toFixed(decimals)} ${toSym}`;
}

export async function buildConvertQuote(input: ConvertQuoteInput): Promise<ConvertQuoteResult> {
  const from = convertAssetById(input.fromAsset);
  const to = convertAssetById(input.toAsset);
  if (from.id === to.id) {
    throw new Error('same_asset');
  }
  if (!Number.isFinite(input.amountUi) || input.amountUi <= 0) {
    throw new Error('invalid_amount');
  }

  const fromRaw = uiAmountToRaw(input.amountUi, from.decimals);

  if (isSolanaJupiterSwap(from, to)) {
    const inputMint = from.solMint!;
    const outputMint = to.solMint!;
    const quote = await getQuote({
      userId: input.userId,
      inputMint,
      outputMint,
      amountRaw: fromRaw,
      slippageBps: 50,
      dynamicSlippage: true,
    });

    const swap = await getSwapTx(quote, input.fromAddress, { landing: 'jito' });
    const outRaw = typeof quote.outAmount === 'string' ? quote.outAmount : '0';
    const toUi = rawAmountToUi(outRaw, to.decimals);
    const rate = input.amountUi > 0 ? toUi / input.amountUi : 0;

    return {
      provider: 'jupiter',
      fromAsset: from.id,
      toAsset: to.id,
      fromAmountUi: input.amountUi,
      toAmountUi: toUi,
      toAmountMinUi: null,
      rateLabel: formatRateLabel(from.label, to.label, rate),
      transaction: swap.swapTransaction,
      tool: 'jupiter',
    };
  }

  const toAddress =
    pickWalletForLifiChain(input.wallets, to.lifiChain) ??
    (to.lifiChain === from.lifiChain ? input.fromAddress : null);

  if (!toAddress) {
    throw new Error('missing_destination_wallet');
  }

  const lifi = await fetchLifiQuote({
    fromChain: from.lifiChain,
    toChain: to.lifiChain,
    fromToken: from.lifiToken,
    toToken: to.lifiToken,
    fromAmount: fromRaw,
    fromAddress: input.fromAddress,
    toAddress,
    slippage: 0.005,
  });

  const toDecimals = lifi.action?.toToken?.decimals ?? to.decimals;
  const toUi = rawAmountToUi(lifi.estimate.toAmount, toDecimals);
  const toMinUi = rawAmountToUi(lifi.estimate.toAmountMin, toDecimals);
  const rate = input.amountUi > 0 ? toUi / input.amountUi : 0;
  const tx =
    from.lifiChain === 'SOL' ? lifiSolanaTransactionBase64(lifi) : null;

  return {
    provider: 'lifi',
    fromAsset: from.id,
    toAsset: to.id,
    fromAmountUi: input.amountUi,
    toAmountUi: toUi,
    toAmountMinUi: toMinUi,
    rateLabel: formatRateLabel(from.label, to.label, rate),
    transaction: tx,
    tool: lifi.tool ?? 'lifi',
  };
}
