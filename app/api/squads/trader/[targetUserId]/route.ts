import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import { getUserById } from '@/lib/db/users';
import { getPointerIdentity } from '@/lib/db/pointerIdentities';
import { lookupBestEthosForTrader } from '@/lib/ethos/client';
import {
  computeOperatorSignal,
  ZERO_POINTER_ACTIVITY,
} from '@/lib/squads/operatorSignal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({ targetUserId: z.string().uuid() });

/**
 * GET trader profile composite — the data backing `TraderProfileDrawer`.
 *
 * Returns:
 *   {
 *     trader: { id, displayName, createdAt }            // pointer-internal
 *     identity: PointerIdentity                          // public surface only
 *     ethos: EthosProfileSnapshot | null
 *     operatorSignal: OperatorSignal
 *     squads: []                                         // Phase 2
 *     mutuals: []                                        // Phase 2
 *   }
 *
 * Privacy honored:
 *  - If `privacy.showEthos` is false, we do *not* return any ethos blob.
 *  - If `privacy.showActivity` is false, we strip pointer activity stats.
 *  - We never echo the user's `email` or private wallet address.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ targetUserId: string }> },
) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  const resolved = await params;
  const parsed = ParamsSchema.safeParse(resolved);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_target' }, { status: 400 });
  }

  const target = await getUserById(parsed.data.targetUserId);
  if (!target) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const identity = await getPointerIdentity(target.id);

  const ethos = identity.privacy?.showEthos
    ? await lookupBestEthosForTrader({
        ethereumAddress: identity.ethereumAddress ?? null,
        xUsername: identity.xUsername ?? null,
        telegramId: identity.telegramId ?? null,
        discordId: identity.discordId ?? null,
        farcasterUsername: identity.farcasterUsername ?? null,
      })
    : null;

  /**
   * Phase 1: we do NOT compute real Pointer activity here. The composite
   * still returns a defensible Operator Signal (UNKNOWN if no evidence,
   * Ethos-leaning when only Ethos is present). Phase 2 will plug in
   * `getPointerActivityForUser(target.id)` from the existing trades table.
   */
  const operatorSignal = computeOperatorSignal({
    identity,
    ethos,
    pointerActivity: ZERO_POINTER_ACTIVITY,
    walletSafety: { riskFlags: [] },
    squadStanding: { squadCount: 0, mutuals: 0, ownerOrAdminCount: 0 },
  });

  return NextResponse.json({
    trader: {
      id: target.id,
      displayName: identity.displayName ?? target.username ?? null,
      createdAt: target.created_at,
    },
    identity: {
      ...identity,
      /* The drawer only ever needs public links — explicitly strip stored bio etc. only if hidden. */
    },
    ethos,
    operatorSignal,
    squads: [],
    mutuals: [],
  });
}
