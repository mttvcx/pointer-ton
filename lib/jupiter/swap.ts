import 'server-only';

import { DEFAULT_JITO_TIP_LAMPORTS, JUPITER_SWAP_URL } from '@/lib/utils/constants';
import { solToLamports } from '@/lib/utils/formatters';

export type SwapLanding = 'jito' | 'rpc';

export type JupiterSwapResponse = {
  swapTransaction: string;
  lastValidBlockHeight?: number;
  prioritizationFeeLamports?: unknown;
  simulationError?: unknown;
};

/** Per-preset fee knobs (matches `trading_presets` + quote API). */
export type SwapFeeParams = {
  jitoTipLamports: number;
  priorityFeeLamports: number;
  autoFee: boolean;
  maxFeeSol: number;
};

const RPC_AUTO_MAX_LAMPORTS_CEILING = 2_000_000;

function envJitoTipLamports(): number {
  const n = Number(process.env.JITO_TIP_LAMPORTS);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_JITO_TIP_LAMPORTS;
}

export function getDefaultSwapFeeParams(): SwapFeeParams {
  return {
    jitoTipLamports: envJitoTipLamports(),
    priorityFeeLamports: 100_000,
    autoFee: true,
    maxFeeSol: 0.1,
  };
}

/**
 * Jupiter `/swap` prioritization payload for v6.
 * @see https://dev.jup.ag/docs/swap-api/build-swap-transaction
 */
export function buildPrioritizationFeeLamports(
  landing: SwapLanding,
  fees: SwapFeeParams,
): unknown {
  const jito = Math.max(0, Math.floor(fees.jitoTipLamports));
  if (landing === 'jito') {
    return { jitoTipLamports: jito };
  }

  const maxCap = Number(solToLamports(Math.min(5, Math.max(fees.maxFeeSol, 0.000001))));

  if (fees.autoFee) {
    const maxLamports = Math.min(
      RPC_AUTO_MAX_LAMPORTS_CEILING,
      Number.isFinite(maxCap) && maxCap > 0 ? Math.floor(maxCap) : RPC_AUTO_MAX_LAMPORTS_CEILING,
    );
    return {
      priorityLevelWithMaxLamports: {
        priorityLevel: 'high' as const,
        maxLamports: maxLamports,
      },
    };
  }

  const fixed = Math.max(0, Math.floor(fees.priorityFeeLamports));
  const cap = Number.isFinite(maxCap) && maxCap > 0 ? Math.floor(maxCap) : fixed;
  return Math.min(fixed, cap);
}

function defaultPrioritizationPayload(landing: SwapLanding): unknown {
  return buildPrioritizationFeeLamports(landing, getDefaultSwapFeeParams());
}

/**
 * Build an unsigned versioned swap transaction (base64) from a quote response.
 */
export async function getSwapTx(
  quoteResponse: unknown,
  userPublicKey: string,
  opts?: {
    dynamicSlippage?: boolean;
    landing?: SwapLanding;
    fees?: SwapFeeParams;
  },
): Promise<JupiterSwapResponse> {
  const landing = opts?.landing ?? 'jito';
  const prioritizationFeeLamports = opts?.fees
    ? buildPrioritizationFeeLamports(landing, opts.fees)
    : defaultPrioritizationPayload(landing);

  const body = {
    quoteResponse,
    userPublicKey,
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
    dynamicSlippage: opts?.dynamicSlippage !== false,
    asLegacyTransaction: false,
    prioritizationFeeLamports,
  };

  const res = await fetch(JUPITER_SWAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as JupiterSwapResponse & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(
      `Jupiter swap ${res.status}: ${typeof json.error === 'string' ? json.error : JSON.stringify(json).slice(0, 400)}`,
    );
  }
  if (!json.swapTransaction || typeof json.swapTransaction !== 'string') {
    throw new Error('Jupiter swap: missing swapTransaction');
  }
  if (json.simulationError) {
    throw new Error(`Jupiter swap simulation: ${JSON.stringify(json.simulationError)}`);
  }

  return json;
}
