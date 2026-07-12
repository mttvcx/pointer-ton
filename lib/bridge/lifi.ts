import 'server-only';

const LIFI_BASE = 'https://li.quest/v1';
const INTEGRATOR = process.env.LIFI_INTEGRATOR?.trim() || 'pointer';

export type LifiQuoteParams = {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toAddress: string;
  slippage?: number;
};

export type LifiQuoteResult = {
  estimate: {
    toAmount: string;
    toAmountMin: string;
    fromAmount: string;
    /** ERC-20 spender to approve before an EVM swap (the LiFi diamond / router). */
    approvalAddress?: string;
  };
  action: {
    fromToken: { symbol: string; decimals: number };
    toToken: { symbol: string; decimals: number };
  };
  transactionRequest?: {
    data?: string;
    to?: string;
    value?: string;
    chainId?: number;
    chainType?: string;
  };
  tool?: string;
};

export async function fetchLifiQuote(params: LifiQuoteParams): Promise<LifiQuoteResult> {
  const qs = new URLSearchParams({
    fromChain: params.fromChain,
    toChain: params.toChain,
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromAmount: params.fromAmount,
    fromAddress: params.fromAddress,
    toAddress: params.toAddress,
    integrator: INTEGRATOR,
    slippage: String(params.slippage ?? 0.005),
  });

  const res = await fetch(`${LIFI_BASE}/quote?${qs.toString()}`, { cache: 'no-store' });
  const json: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      json && typeof json === 'object' && 'message' in json
        ? String((json as { message: unknown }).message)
        : JSON.stringify(json).slice(0, 300);
    throw new Error(`lifi_quote_${res.status}: ${msg}`);
  }

  return json as LifiQuoteResult;
}

/** Solana bridge/swap steps return a base64 serialized transaction in `transactionRequest.data`. */
export function lifiSolanaTransactionBase64(quote: LifiQuoteResult): string | null {
  const data = quote.transactionRequest?.data;
  return typeof data === 'string' && data.length > 40 ? data : null;
}
