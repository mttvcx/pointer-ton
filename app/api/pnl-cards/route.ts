import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePointerUser } from '@/lib/api/privyUser';
import { findPnlCardByUserTrade, insertPnlCard, listPnlCardsForUser } from '@/lib/db/pnlCards';
import { getTokenByMint } from '@/lib/db/tokens';
import { getTradeByIdForUser } from '@/lib/db/trades';
import { PnlCardDataSchema } from '@/lib/pnl/pnlCardModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isSafeHttpsUrl(raw: string): boolean {
  try {
    return new URL(raw).protocol === 'https:';
  } catch {
    return false;
  }
}

const postSchema = z
  .object({
    tradeId: z.string().uuid(),
    backgroundType: z.enum(['plain', 'gradient', 'image']).default('plain'),
    backgroundPreset: z.string().max(64).nullable().optional(),
    backgroundUrl: z.string().nullable().optional(),
    displayRealizedPnlSol: z.number().finite().nullable().optional(),
    displayRealizedPnlUsd: z.number().finite().nullable().optional(),
  })
  .strict();

export async function GET(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  const rawLimit = req.nextUrl.searchParams.get('limit');
  const limit = Math.min(100, Math.max(1, rawLimit ? Number(rawLimit) || 30 : 30));

  try {
    const rows = await listPnlCardsForUser(auth.user.id, limit);
    const cards = rows.map((r) => {
      const parsed = PnlCardDataSchema.safeParse(r.card_data);
      const d = parsed.success ? parsed.data : null;
      return {
        id: r.id,
        shareToken: r.share_token,
        path: `/share/${r.share_token}`,
        createdAt: r.created_at,
        viewCount: r.view_count,
        mint: d?.mint ?? '',
        symbol: d?.symbol ?? null,
        side: d?.side ?? 'buy',
        displayRealizedPnlUsd: d?.displayRealizedPnlUsd ?? null,
      };
    });
    return NextResponse.json({ cards });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'list_failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const b = parsed.data;
  let safeBgUrl: string | null = null;
  if (b.backgroundUrl != null && b.backgroundUrl.trim() !== '') {
    const t = b.backgroundUrl.trim();
    if (!isSafeHttpsUrl(t)) {
      return NextResponse.json({ error: 'invalid_background_url' }, { status: 400 });
    }
    safeBgUrl = t;
  }

  const trade = await getTradeByIdForUser(auth.user.id, b.tradeId);
  if (!trade) {
    return NextResponse.json({ error: 'trade_not_found' }, { status: 404 });
  }
  if (trade.status !== 'confirmed') {
    return NextResponse.json({ error: 'trade_not_confirmed' }, { status: 400 });
  }

  const existing = await findPnlCardByUserTrade(auth.user.id, b.tradeId);
  if (existing) {
    return NextResponse.json({
      path: `/share/${existing.share_token}`,
      shareToken: existing.share_token,
      reused: true,
    });
  }

  const token = await getTokenByMint(trade.mint);
  const decimals = token?.decimals ?? 9;

  const cardData = PnlCardDataSchema.parse({
    mint: trade.mint,
    symbol: token?.symbol ?? null,
    name: token?.name ?? null,
    imageUrl: token?.image_url ?? null,
    side: trade.side,
    submittedAt: trade.submitted_at,
    confirmedAt: trade.confirmed_at,
    amountSol: trade.amount_sol,
    amountToken: trade.amount_token,
    decimals,
    priceUsdAtFill: trade.price_usd_at_fill,
    txSignature: trade.tx_signature,
    displayRealizedPnlSol: b.displayRealizedPnlSol ?? null,
    displayRealizedPnlUsd: b.displayRealizedPnlUsd ?? null,
  });

  const row = await insertPnlCard({
    user_id: auth.user.id,
    trade_id: trade.id,
    background_type: b.backgroundType,
    background_preset: b.backgroundPreset ?? null,
    background_url: safeBgUrl,
    card_data: cardData,
  });

  return NextResponse.json({
    path: `/share/${row.share_token}`,
    shareToken: row.share_token,
    reused: false,
  });
}
