import { NextResponse } from 'next/server';
import { z } from 'zod';
import { kalshiConfigured, kalshiCreateOrder } from '@/lib/kalshi/client';
import { CreateOrderBodySchema } from '@/lib/kalshi/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!kalshiConfigured()) {
    return NextResponse.json(
      { error: 'kalshi_auth_missing', message: 'Kalshi API keys not configured on server.' },
      { status: 503 },
    );
  }

  try {
    const raw = await req.json();
    const body = CreateOrderBodySchema.parse(raw);
    const order = await kalshiCreateOrder(body);
    return NextResponse.json({ ok: true, order });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'invalid_body', details: err.flatten() }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'order_failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET() {
  return NextResponse.json({ configured: kalshiConfigured() });
}
