import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { executeEmergencySell, executeEmergencySellAll } from '@/lib/admin/emergencySell';
import { logAdminAction } from '@/lib/db/admin';
import {
  finalizeEmergencyAction,
  insertEmergencyAction,
} from '@/lib/db/emergencyActions';
import { getUserById } from '@/lib/db/users';
import type { Json } from '@/lib/supabase/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    walletAddress: z.string().min(32),
    mint: z.string().min(32).optional(),
    sellAll: z.boolean().default(false),
    sellPct: z.coerce.number().int().min(1).max(100).default(100),
    slippageBps: z.coerce.number().int().min(50).max(3000).optional(),
    reason: z.string().trim().min(8).max(500),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!val.sellAll && !val.mint) {
      ctx.addIssue({ code: 'custom', message: 'mint required unless sellAll', path: ['mint'] });
    }
  });

/** Server-signed protective sell — bypasses freeze; attacker sees normal on-chain activity only. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdmin(req, 'account.emergency_sell');
  if (!auth.ok) return auth.response;

  const { userId } = await ctx.params;
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  const actionType = body.sellAll ? 'emergency_sell_all' : 'emergency_sell';
  const auditRow = await insertEmergencyAction({
    targetUserId: userId,
    action: actionType,
    walletAddress: body.walletAddress,
    mint: body.sellAll ? null : (body.mint ?? null),
    reason: body.reason,
    performedByUserId: auth.ctx.userId === 'system' ? null : auth.ctx.userId,
    metadata: { sellPct: body.sellPct, sellAll: body.sellAll },
  });

  try {
    if (body.sellAll) {
      const results = await executeEmergencySellAll({
        targetUser: user,
        walletAddress: body.walletAddress,
        slippageBps: body.slippageBps,
      });
      const last = results[results.length - 1]!;
      await finalizeEmergencyAction({
        id: auditRow.id,
        status: 'confirmed',
        txSignature: last.signature,
        metadataPatch: { results },
      });
      await logAdminAction({
        ctx: auth.ctx,
        action: 'account.emergency_sell_all',
        targetType: 'user',
        targetId: userId,
        reason: body.reason,
        after: { results } as unknown as Json,
        metadata: { walletAddress: body.walletAddress, count: results.length },
        ip: auth.ip,
      });
      return NextResponse.json({ ok: true, results, emergencyActionId: auditRow.id });
    }

    const result = await executeEmergencySell({
      targetUser: user,
      walletAddress: body.walletAddress,
      mint: body.mint!,
      sellPct: body.sellPct,
      slippageBps: body.slippageBps,
    });
    await finalizeEmergencyAction({
      id: auditRow.id,
      status: 'confirmed',
      txSignature: result.signature,
      metadataPatch: { result },
    });
    await logAdminAction({
      ctx: auth.ctx,
      action: 'account.emergency_sell',
      targetType: 'user',
      targetId: userId,
      reason: body.reason,
      after: result as unknown as Json,
      metadata: { walletAddress: body.walletAddress, mint: body.mint, sellPct: body.sellPct },
      ip: auth.ip,
    });
    return NextResponse.json({ ok: true, result, emergencyActionId: auditRow.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'emergency_sell_failed';
    await finalizeEmergencyAction({
      id: auditRow.id,
      status: 'failed',
      errorMessage: message,
    });
    const status =
      message === 'server_signer_not_configured' ||
      message === 'wallet_missing_server_signer' ||
      message === 'wallet_not_privy_embedded'
        ? 503
        : 502;
    return NextResponse.json({ error: message, emergencyActionId: auditRow.id }, { status });
  }
}
