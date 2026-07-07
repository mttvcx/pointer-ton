import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import { buildEvmLaunchMeta } from '@/lib/launch/evmLaunchMeta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/launch/evm-meta — server-side metadata prep for client EVM launches
 * on pads that need it (zora → JSON metadata URI, flaunch → base64 image). Done
 * server-side to dodge browser CORS on the IPFS upload + image fetch. The browser
 * then runs the pad SDK with these values + the user's wallet.
 */
const Body = z
  .object({
    name: z.string().trim().min(1).max(64),
    symbol: z.string().trim().min(1).max(16),
    description: z.string().trim().max(2000).nullable().optional(),
    imageUrl: z.string().url().max(2048).nullable().optional(),
    twitter: z.string().trim().max(400).nullable().optional(),
    website: z.string().trim().max(400).nullable().optional(),
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

  const { metadataUri, base64Image } = await buildEvmLaunchMeta({
    name: body.name,
    symbol: body.symbol.replace(/^\$/, '').toUpperCase(),
    description: body.description ?? null,
    imageUrl: body.imageUrl ?? null,
    twitter: body.twitter ?? null,
    website: body.website ?? null,
  });

  return NextResponse.json({ ok: true, metadataUri, base64Image });
}
