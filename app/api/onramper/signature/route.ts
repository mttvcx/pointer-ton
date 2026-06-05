import { NextResponse } from 'next/server';

import { buildOnramperWidgetUrl } from '@/lib/onramper/buildOnramperWidgetUrl';
import { onramperSignatureRequestSchema } from '@/lib/onramper/schemas';

/**
 * POST `/api/onramper/signature`
 *
 * Builds a signed (when configured) buy.onramper.com URL with prefilled routing for the active Pointer chain.
 *
 * Requires:
 * - `ONRAMPER_API_KEY` or `NEXT_PUBLIC_ONRAMPER_API_KEY`
 * Recommended for pinned wallet addresses:
 * - `ONRAMPER_SIGNING_SECRET` — HMAC key from Onramper for `networkWallets` signing
 *
 * TODO: Rotate keys via secrets manager — never embed live secrets in the repo.
 */

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = onramperSignatureRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { activeChain, walletAddress, defaultFiat, fiatAmount, partnerContext } = parsed.data;

  try {
    const result = buildOnramperWidgetUrl(
      {
        activeChain,
        walletAddress,
        defaultFiat: defaultFiat ?? 'USD',
        fiatAmount,
        partnerContext,
      },
      {},
    );

    return NextResponse.json({
      widgetUrl: result.widgetUrl,
      signed: result.signed,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unable to build Onramper session';
    if (message.includes('API key')) {
      /** Configuration gap — callers can fall back to static marketing links. */
      return NextResponse.json(
        {
          error: message,
          code: 'ONRAMPER_NOT_CONFIGURED',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
