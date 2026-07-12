import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePointerUser } from '@/lib/api/privyUser';
import { isKaminoConfigured, quoteCredit } from '@/lib/financial/kaminoClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Credit mode (spend-without-selling) status + borrow quote. `configured:false`
 * (Kamino not wired) → the app uses its local borrow simulation. Quote math is
 * pure + safe; actually building/signing a borrow is gated behind KAMINO_ENABLED
 * and a security review (non-custodial: the client signs the Kamino tx via Privy).
 */
const Query = z.object({
  collateralUsd: z.coerce.number().min(0).max(1e12),
  borrowedUsd: z.coerce.number().min(0).max(1e12).default(0),
});

export async function GET(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    collateralUsd: url.searchParams.get('collateralUsd') ?? 0,
    borrowedUsd: url.searchParams.get('borrowedUsd') ?? 0,
  });
  if (!parsed.success) return NextResponse.json({ error: 'invalid_query' }, { status: 400 });

  const quote = quoteCredit(parsed.data.collateralUsd, parsed.data.borrowedUsd);
  return NextResponse.json({
    configured: isKaminoConfigured(),
    quote: {
      creditAvailableUsd: quote.creditAvailableUsd,
      healthFactor: Number.isFinite(quote.healthFactor) ? quote.healthFactor : null,
      liquidationDropPct: quote.liquidationDropPct,
      borrowAprUser: quote.borrowAprUser,
    },
  });
}
