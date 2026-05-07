import 'server-only';

import { getFeeBpsForUser } from '@/lib/db/tiers';
import { isValidPublicKey } from '@/lib/utils/addresses';
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

function referralFeeAccount(): string | null {
  const a =
    process.env.JUPITER_REFERRAL_ACCOUNT?.trim() ||
    process.env.JUPITER_FEE_ACCOUNT?.trim();
  if (!a || !isValidPublicKey(a)) return null;
  return a;
}

/**
 * Jupiter v6 quote with optional referral `platformFeeBps` from {@link getFeeBpsForUser}.
 */
export async function getQuote(input: JupiterQuoteInput): Promise<JupiterQuoteResponse> {
  const platformFeeBps = await getFeeBpsForUser(input.userId);
  const feeAccount = referralFeeAccount();

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

  if (platformFeeBps > 0 && feeAccount) {
    params.set('platformFeeBps', String(platformFeeBps));
    params.set('feeAccount', feeAccount);
  }

  const url = `${JUPITER_QUOTE_URL}?${params.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
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
