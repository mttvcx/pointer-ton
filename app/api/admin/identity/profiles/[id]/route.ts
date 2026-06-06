import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import { logAdminAction } from '@/lib/db/admin';
import {
  getIdentityProfile,
  listIdentityWallets,
  upsertIdentityWallet,
  updateIdentityProfile,
  deleteIdentityProfile,
  deleteIdentityWallet,
} from '@/lib/db/identities';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ActionBody = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add_wallet'),
    chain: z.enum(['sol', 'eth', 'bnb', 'base', 'ton']),
    address: z.string().trim().min(8).max(120),
    label: z.string().trim().max(120).optional(),
    source: z.string().trim().min(1).max(60).default('admin'),
    sourceUrl: z.string().trim().url().max(300).optional(),
    verified: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('update_profile'),
    displayName: z.string().trim().min(1).max(120).optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    verified: z.boolean().optional(),
  }),
  z.object({ action: z.literal('delete_wallet'), walletId: z.string().uuid() }),
  z.object({ action: z.literal('delete_profile') }),
]);

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req, 'identity.read');
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  try {
    const [profile, wallets] = await Promise.all([getIdentityProfile(id), listIdentityWallets(id)]);
    if (!profile) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ profile, wallets });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'get_failed';
    return NextResponse.json({ error: 'get_failed', message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req, 'identity.write');
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  let body: z.infer<typeof ActionBody>;
  try {
    body = ActionBody.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  try {
    if (body.action === 'add_wallet') {
      const wallet = await upsertIdentityWallet({
        identityId: id,
        chain: body.chain,
        address: body.address,
        label: body.label,
        source: body.source,
        sourceUrl: body.sourceUrl,
        verified: body.verified,
      });
      await logAdminAction({
        ctx: auth.ctx,
        action: 'identity.wallet.upsert',
        targetType: 'identity_wallet',
        targetId: wallet.id,
        metadata: { identityId: id, chain: body.chain, address: body.address },
        ip: auth.ip,
      });
      return NextResponse.json({ wallet });
    }

    if (body.action === 'update_profile') {
      const profile = await updateIdentityProfile(id, {
        displayName: body.displayName,
        notes: body.notes,
        verified: body.verified,
      });
      await logAdminAction({
        ctx: auth.ctx,
        action: 'identity.profile.update',
        targetType: 'identity_profile',
        targetId: id,
        ip: auth.ip,
      });
      return NextResponse.json({ profile });
    }

    if (body.action === 'delete_wallet') {
      await deleteIdentityWallet(body.walletId);
      await logAdminAction({
        ctx: auth.ctx,
        action: 'identity.wallet.delete',
        targetType: 'identity_wallet',
        targetId: body.walletId,
        ip: auth.ip,
      });
      return NextResponse.json({ ok: true });
    }

    // delete_profile
    await deleteIdentityProfile(id);
    await logAdminAction({
      ctx: auth.ctx,
      action: 'identity.profile.delete',
      targetType: 'identity_profile',
      targetId: id,
      ip: auth.ip,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'action_failed';
    return NextResponse.json({ error: 'action_failed', message }, { status: 500 });
  }
}
