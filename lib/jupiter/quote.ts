import 'server-only';

import { getFeeBpsForUser } from '@/lib/db/tiers';
import { jupiterRequestHeaders, wrapJupiterFetchError } from '@/lib/jupiter/httpHeaders';
import { resolveJupiterFeeAccountForSwap } from '@/lib/jupiter/referralFee';
import { JUPITER_QUOTE_URL } from '@/lib/utils/constants';

export type JupiterQuoteInput = {
  /** Supabase `users.id` (for platform fee tier). */
  userId: string;
  inputMint: string;
  outputMint: string;
  /** Raw integer string (atomic units), per Jupiter. */
  amountRaw: string;
  slippageBps: number;
  swapMode?: 'ExactIn' | 'ExactOut';
  /** Passed through to Jupiter; default true. */
  dynamicSlippage?: boolean;
};

/** Raw Jupiter `/quote` JSON (shape varies by router). */
export type JupiterQuoteResponse = Record<string, unknown> & {
  inputMint?: string;
  outputMint?: string;
  inAmount?: string;
  outAmount?: string;
  error?: string;
};

/**
 * Jupiter swap quote with optional referral `platformFeeBps` from {@link getFeeBpsForUser}.
 */
export async function getQuote(input: JupiterQuoteInput): Promise<JupiterQuoteResponse> {
  const platformFeeBps = await getFeeBpsForUser(input.userId);
  const feeAccount =
    platformFeeBps > 0
      ? await resolveJupiterFeeAccountForSwap({
          inputMint: input.inputMint,
          outputMint: input.outputMint,
          swapMode: input.swapMode,
        })
      : null;

  const params = new URLSearchParams({
    inputMint: input.inputMint,
    outputMint: input.outputMint,
    amount: input.amountRaw,
    slippageBps: String(input.slippageBps),
    swapMode: input.swapMode ?? 'ExactIn',
  });

  if (input.dynamicSlippage !== false) {
    params.set('dynamicSlippage', 'true');
  }

  // Required for platform fees on Token-2022 pairs (pump.fun graduates) and future Jupiter features.
  params.set('instructionVersion', 'V2');

  if (platformFeeBps > 0 && feeAccount) {
    params.set('platformFeeBps', String(platformFeeBps));
    params.set('feeAccount', feeAccount);
  }

  const url = `${JUPITER_QUOTE_URL}?${params.toString()}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', headers: jupiterRequestHeaders() });
  } catch (err) {
    throw wrapJupiterFetchError(err, 'quote');
  }
  const json = (await res.json().catch(() => ({}))) as JupiterQuoteResponse;

  if (!res.ok) {
    const msg =
      typeof json.error === 'string' ? json.error : JSON.stringify(json).slice(0, 400);
    throw new Error(`Jupiter quote ${res.status}: ${msg}`);
  }
  if (typeof json.error === 'string' && json.error) {
    throw new Error(`Jupiter quote: ${json.error}`);
  }

  return json;
}
