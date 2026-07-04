import 'server-only';

/**
 * Pointer buy → Crossmint order (server-side creation).
 *
 * Crossmint's embedded ONRAMP (fiat → token via Apple Pay) does NOT allow
 * client-side order creation, so the app can't build the order itself. We create
 * it here with the SECRET server key, then hand the app back an `orderId` +
 * `clientSecret` to render the Apple Pay sheet against (existing-order flow).
 *
 * Users never see "Crossmint" — this is the plumbing behind "Buy with Apple Pay".
 *
 * KEY-GATED: with no `CROSSMINT_SERVER_KEY` set, `isConfigured()` is false and the
 * route reports `configured: false` so the app keeps its honest "almost here"
 * state instead of a broken checkout. Nothing here fabricates a charge.
 *
 * NOTE: the order payload follows Crossmint's documented 2022-06-09 shape but the
 * exact `payment.method` / response fields SHOULD be re-verified against a real
 * staging order before flipping this on with a live key.
 */

const CM_CHAIN: Record<string, string> = { sol: 'solana', eth: 'ethereum', base: 'base', bnb: 'bsc' };

export function isCrossmintOrderConfigured(): boolean {
  return !!process.env.CROSSMINT_SERVER_KEY?.trim();
}

function crossmintBase(): string {
  // Staging by default; set CROSSMINT_API_BASE to the production host to go live.
  return (
    process.env.CROSSMINT_API_BASE?.trim() ||
    (process.env.CROSSMINT_ENV === 'production'
      ? 'https://www.crossmint.com/api/2022-06-09'
      : 'https://staging.crossmint.com/api/2022-06-09')
  );
}

/** "<chain>:<address>" locator Crossmint uses to identify a token. */
export function tokenLocator(chain: string | undefined, mint: string): string {
  return `${CM_CHAIN[chain ?? 'sol'] ?? 'solana'}:${mint}`;
}

export type CreateOrderInput = {
  chain?: string;
  mint: string;
  /** USD to spend, plain string ("5", "25"). */
  amountUsd: string;
  /** Where the token is delivered — the user's embedded wallet on that chain. */
  recipientWallet: string;
  receiptEmail?: string | null;
  maxSlippageBps?: string;
};

export type CreateOrderResult = { orderId: string; clientSecret: string };

export class CrossmintOrderError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'CrossmintOrderError';
  }
}

export async function createCrossmintOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const key = process.env.CROSSMINT_SERVER_KEY?.trim();
  if (!key) throw new CrossmintOrderError('CROSSMINT_NOT_CONFIGURED', 503);

  const body = {
    recipient: { walletAddress: input.recipientWallet },
    locale: 'en-US',
    payment: {
      method: 'checkoutcom-flow',
      currency: 'usd',
      ...(input.receiptEmail ? { receiptEmail: input.receiptEmail } : {}),
    },
    lineItems: {
      tokenLocator: tokenLocator(input.chain, input.mint),
      executionParameters: {
        mode: 'exact-in',
        amount: input.amountUsd,
        maxSlippageBps: input.maxSlippageBps ?? '500',
      },
    },
  };

  let res: Response;
  try {
    res = await fetch(`${crossmintBase()}/orders`, {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new CrossmintOrderError('CROSSMINT_UNREACHABLE', 502);
  }

  const json = (await res.json().catch(() => ({}))) as {
    order?: { orderId?: string; id?: string; clientSecret?: string };
    orderId?: string;
    clientSecret?: string;
  };
  if (!res.ok) {
    // Never surface Crossmint's raw error to the client — map to a generic status.
    throw new CrossmintOrderError('CROSSMINT_ORDER_FAILED', 502);
  }

  const orderId = json.order?.orderId ?? json.orderId ?? json.order?.id ?? '';
  const clientSecret = json.clientSecret ?? json.order?.clientSecret ?? '';
  if (!orderId || !clientSecret) throw new CrossmintOrderError('CROSSMINT_ORDER_INCOMPLETE', 502);
  return { orderId, clientSecret };
}
