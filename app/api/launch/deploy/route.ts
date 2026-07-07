import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import { deployTokenForChain } from '@/lib/launch/deployTokenForChain';
import { LAUNCH_PACKAGE_LAUNCHPADS } from '@/lib/launch/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/launch/deploy — the real manual launch. Signs with the server-held
 * per-chain deploy burner (never the client) and broadcasts. Chain-agnostic:
 * dispatches to pump.fun (SOL) / viem launchpad (EVM) / TON. Returns the created
 * token address + tx + explorer link, or a clear reason when a chain's deploy
 * wallet / launchpad isn't configured yet.
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
    devBuyNative: z.number().min(0).max(420).optional(),
  })
  .strict();

/** Friendly messages for the known "not configured" errors. */
const REASONS: Record<string, string> = {
  deploy_wallet_not_configured: 'Solana deploy wallet not configured — set DEPLOY_WALLET_SECRET.',
  evm_deploy_wallet_not_configured: 'EVM deploy wallet not configured — set EVM_DEPLOY_WALLET_KEY.',
  evm_deploy_wallet_invalid: 'EVM_DEPLOY_WALLET_KEY is not a valid 0x private key.',
  ton_launch_not_wired: 'TON launch isn’t wired yet.',
};

export async function POST(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: 'invalid_body', message: err instanceof Error ? err.message : 'invalid' }, { status: 400 });
  }

  try {
    const result = await deployTokenForChain(body.chain, {
      name: body.name,
      symbol: body.symbol.replace(/^\$/, '').toUpperCase(),
      description: body.description,
      imageUrl: body.imageUrl ?? null,
      twitter: body.twitter ?? null,
      website: body.website ?? null,
      launchpad: body.launchpad,
      devBuyNative: body.devBuyNative ?? 0,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'deploy_failed';
    const key = code.split(':')[0]!;
    const message = REASONS[key] ?? (code.startsWith('evm_launchpad_not_wired') ? `${body.launchpad} launch factory isn’t wired yet.` : code);
    // 501 for "not configured / not wired" (actionable), 500 for genuine failures.
    const notReady = key in REASONS || code.startsWith('evm_launchpad_not_wired');
    return NextResponse.json({ error: code, message }, { status: notReady ? 501 : 500 });
  }
}
