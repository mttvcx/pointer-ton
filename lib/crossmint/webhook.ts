import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Crossmint signs webhooks with Svix. Verify by HMAC-SHA256 over
 * `${svix-id}.${svix-timestamp}.${rawBody}` using the base64 part of the signing
 * secret (after the `whsec_` prefix). The `svix-signature` header is a
 * space-separated list of `v1,<base64>` sigs. Must use the RAW body (never
 * re-stringified). Key-gated on CROSSMINT_WEBHOOK_SECRET.
 */
export function isCrossmintConfigured(): boolean {
  return !!process.env.CROSSMINT_WEBHOOK_SECRET?.trim();
}

export function verifyCrossmintWebhook(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
): boolean {
  const secret = process.env.CROSSMINT_WEBHOOK_SECRET?.trim();
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;

  // Replay guard: reject timestamps outside a 5-minute window.
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signedContent = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const expected = createHmac('sha256', key).update(signedContent).digest('base64');

  // Header can carry multiple versioned sigs: "v1,<b64> v1,<b64>".
  const provided = headers.signature
    .split(' ')
    .map((part) => part.split(',')[1])
    .filter((v): v is string => Boolean(v));

  const exp = Buffer.from(expected);
  return provided.some((p) => {
    const got = Buffer.from(p);
    return got.length === exp.length && timingSafeEqual(got, exp);
  });
}

/* ---- Defensive order-event parsing ---- */

export type CrossmintBuy = {
  chain: string; // 'solana' | 'bsc' | ...
  mint: string;
  recipientWallet: string | null;
  amountUsd: number | null;
  amountOutRaw: string | null; // tokens delivered, if present
  orderId: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepFind(obj: any, pred: (k: string, v: any) => boolean, depth = 0): any {
  if (obj == null || depth > 6) return undefined;
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (pred(k, v)) return v;
      const nested = deepFind(v, pred, depth + 1);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}

/**
 * Extract a token buy from a Crossmint order/payment event. Defensive because the
 * exact envelope varies by product/version — verify the shape against a real
 * event and tighten later. Returns null if this isn't a completed token delivery
 * we can attribute (e.g. non-Solana in v1, or missing fields).
 */
export function parseCrossmintBuy(event: unknown): CrossmintBuy | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = event as any;
  const type: string = String(e?.type ?? e?.event ?? '');
  const completed = /succeed|complete|deliver|fulfilled/i.test(type);
  if (!completed) return null;

  const data = e?.data ?? e;

  // tokenLocator looks like "solana:<mint>" / "bsc:<addr>".
  const locator: string | undefined = deepFind(data, (k, v) => (k === 'tokenLocator' || k === 'locator') && typeof v === 'string');
  let chain = '';
  let mint = '';
  if (locator && locator.includes(':')) {
    const [c, m] = locator.split(':');
    chain = c ?? '';
    mint = m ?? '';
  } else {
    mint = deepFind(data, (k, v) => (k === 'mint' || k === 'tokenMint' || k === 'contractAddress') && typeof v === 'string') ?? '';
    chain = deepFind(data, (k, v) => k === 'chain' && typeof v === 'string') ?? '';
  }
  if (!mint) return null;

  const recipientWallet: string | null =
    deepFind(data, (k, v) => (k === 'walletAddress' || k === 'recipientAddress' || k === 'address') && typeof v === 'string') ?? null;

  const amountUsdRaw = deepFind(data, (k, v) => (k === 'totalUsd' || k === 'amountUsd' || k === 'totalPrice' || k === 'amount') && (typeof v === 'number' || typeof v === 'string'));
  const amountUsd = amountUsdRaw != null ? Number(amountUsdRaw) : null;

  const amountOutRaw: string | null = (() => {
    const v = deepFind(data, (k, val) => (k === 'quantity' || k === 'amountOutRaw' || k === 'tokenAmount') && (typeof val === 'string' || typeof val === 'number'));
    return v != null ? String(v) : null;
  })();

  const orderId: string = String(deepFind(data, (k, v) => (k === 'orderId' || k === 'id') && typeof v === 'string') ?? '');

  return { chain: chain || 'unknown', mint, recipientWallet, amountUsd: Number.isFinite(amountUsd as number) ? amountUsd : null, amountOutRaw, orderId };
}
