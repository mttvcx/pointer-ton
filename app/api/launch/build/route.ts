import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import { buildSolLaunchTx, pumpPortalPool } from '@/lib/launch/buildSolLaunchTx';
import { LAUNCH_PACKAGE_LAUNCHPADS } from '@/lib/launch/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/launch/build — assemble the UNSIGNED Solana launch tx for the user's
 * own wallet + a client-generated mint. The browser signs it (Privy wallet +
 * mint) and broadcasts via /api/solana/broadcast. No server key: this is the
 * "your main wallet is the deploy wallet" path. Solana-only for now (EVM/TON
 * sign client-side through their own SDKs).
 */
const Body = z
  .object({
    name: z.string().trim().min(1).max(64),
    symbol: z.string().trim().min(1).max(16),
    description: z.string().trim().max(2000).optional(),
    imageUrl: z.string().url().max(2048).nullable().optional(),
    twitter: z.string().trim().max(400).nullable().optional(),
    website: z.string().trim().max(400).nullable().optional(),
    chain: z.enum(['sol', 'eth', 'bnb', 'base', 'ton']),
    launchpad: z.enum(LAUNCH_PACKAGE_LAUNCHPADS),
    ownerAddress: z.string().trim().min(32).max(64),
    mint: z.string().trim().min(32).max(64),
    devBuyNative: z.number().min(0).max(420).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'invalid_body', message: err instanceof Error ? err.message : 'invalid' }, { status: 400 });
  }

  if (body.chain !== 'sol') {
    return NextResponse.json({ error: 'client_build_unsupported', message: 'Client-side build is Solana-only.' }, { status: 400 });
  }

  const pool = pumpPortalPool(body.launchpad);
  if (!pool) {
    return NextResponse.json(
      { error: 'launchpad_not_wired', message: `${body.launchpad} isn’t wired for launch yet — pick pump.fun or bonk.` },
      { status: 501 },
    );
  }

  try {
    const { serializedTxBase64 } = await buildSolLaunchTx({
      ownerPubkey: body.ownerAddress,
      mintPubkey: body.mint,
      name: body.name,
      symbol: body.symbol.replace(/^\$/, '').toUpperCase(),
      description: body.description,
      imageUrl: body.imageUrl ?? null,
      twitter: body.twitter ?? null,
      website: body.website ?? null,
      devBuySol: body.devBuyNative ?? 0,
      pool,
    });
    return NextResponse.json({ ok: true, serializedTx: serializedTxBase64 });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'build_failed';
    return NextResponse.json({ error: code, message: code }, { status: 500 });
  }
}
