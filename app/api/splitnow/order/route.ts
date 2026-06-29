import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { pickDefaultExchanger, splitnowConfigured, splitnowCreateOrder, splitnowCreateQuote } from '@/lib/splitnow/server';
import { assertTradingAllowed, EmergencyBlockedError, emergencyBlockedResponse } from '@/lib/emergency/controls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  fromAmount: z.number().positive(),
  receivers: z.array(z.string().min(32)).min(1).max(100),
});

async function requireAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) return null;
  try {
    await verifyPrivyAccessToken(accessToken);
    return true;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!splitnowConfigured()) {
    return NextResponse.json(
      { error: 'splitnow_not_configured', message: 'Add SPLITNOW_API_KEY to .env.local' },
      { status: 503 },
    );
  }
  // Emergency trading kill switch / maintenance / read-only — fails closed.
  try {
    await assertTradingAllowed('sol');
  } catch (e) {
    if (e instanceof EmergencyBlockedError) return emergencyBlockedResponse(e);
    throw e;
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { fromAmount, receivers } = parsed.data;
  const bipsEach = Math.floor(10_000 / receivers.length);
  const remainder = 10_000 - bipsEach * receivers.length;

  try {
    const quote = await splitnowCreateQuote({
      fromAmount,
      fromAssetId: 'sol',
      fromNetworkId: 'solana',
      toAssetId: 'sol',
      toNetworkId: 'solana',
    });
    const exchangerId = pickDefaultExchanger(quote.rates);
    const order = await splitnowCreateOrder({
      quoteId: quote.quoteId,
      fromAmount,
      fromAssetId: 'sol',
      fromNetworkId: 'solana',
      walletDistributions: receivers.map((toAddress, i) => ({
        toAddress,
        toPctBips: bipsEach + (i === 0 ? remainder : 0),
        toAssetId: 'sol',
        toNetworkId: 'solana',
        toExchangerId: exchangerId,
      })),
    });

    return NextResponse.json({
      quoteId: quote.quoteId,
      exchangerId,
      orderId: order.orderId,
      depositAddress: order.depositAddress,
      depositAmount: order.depositAmount,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'splitnow_order_failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
