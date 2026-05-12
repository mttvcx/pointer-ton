import { NextResponse } from 'next/server';

import type { AppChainId } from '@/lib/chains/appChain';
import { isAppChainId } from '@/lib/chains/appChain';
import { buildOnramperWidgetUrl } from '@/lib/onramper/buildOnramperWidgetUrl';

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

type Body = {
  activeChain?: string;
  walletAddress?: string | null;
  defaultFiat?: string;
  fiatAmount?: number;
  partnerContext?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const activeChainRaw = typeof body.activeChain === 'string' ? body.activeChain.trim() : '';
  if (!isAppChainId(activeChainRaw)) {
    return NextResponse.json({ error: 'Unsupported or missing activeChain' }, { status: 400 });
  }
  const activeChain = activeChainRaw as AppChainId;

  const walletAddress =
    typeof body.walletAddress === 'string' ? body.walletAddress.trim() : '';
  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress required' }, { status: 400 });
  }

  const fiatRaw = typeof body.fiatAmount === 'number' ? body.fiatAmount : NaN;

  try {
    const result = buildOnramperWidgetUrl(
      {
        activeChain,
        walletAddress,
        defaultFiat: typeof body.defaultFiat === 'string' ? body.defaultFiat : 'USD',
        fiatAmount:
          Number.isFinite(fiatRaw) && fiatRaw > 0 && fiatRaw < 500_000 ? fiatRaw : undefined,
        partnerContext:
          typeof body.partnerContext === 'string' ? body.partnerContext : undefined,
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
