import 'server-only';

const LIFI_BASE = 'https://li.quest/v1';
const INTEGRATOR = process.env.LIFI_INTEGRATOR?.trim() || 'pointer';
/** Authenticates the request as our registered integrator so integrator fees attribute + collect. */
const LIFI_API_KEY = process.env.LIFI_API_KEY?.trim();

export type LifiQuoteParams = {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toAddress: string;
  slippage?: number;
  /**
   * Integrator fee as a decimal fraction (e.g. 0.015 = 1.5%). LiFi collects it to
   * the integrator's configured fee wallet. Requires the integrator to be
   * authorized for fees — unauthorized fee requests are rejected by the API.
   */
  fee?: number;
};

/** A non-gas fee line item in a LiFi estimate (includes the integrator fee). */
export type LifiFeeCost = {
  name?: string;
  description?: string;
  percentage?: string;
  amount?: string;
  amountUSD?: string;
  included?: boolean;
  token?: { symbol?: string; address?: string; decimals?: number };
};

export type LifiQuoteResult = {
  estimate: {
    toAmount: string;
    toAmountMin: string;
    fromAmount: string;
    /** ERC-20 spender to approve before an EVM swap (the LiFi diamond / router). */
    approvalAddress?: string;
    /** Non-gas fees applied to this route (protocol + our integrator fee). */
    feeCosts?: LifiFeeCost[];
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
  // Integrator fee — only sent when > 0 (LiFi rejects unauthorized fee requests,
  // which is the desired loud failure if the integrator isn't fee-registered yet).
  if (params.fee != null && params.fee > 0) {
    qs.set('fee', String(params.fee));
  }

  const res = await fetch(`${LIFI_BASE}/quote?${qs.toString()}`, {
    cache: 'no-store',
    headers: LIFI_API_KEY ? { 'x-lifi-api-key': LIFI_API_KEY } : undefined,
  });
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
