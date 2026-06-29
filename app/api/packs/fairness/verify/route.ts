import { NextResponse } from 'next/server';
import { z } from 'zod';
import { openPackServer } from '@/lib/packs/openPack';
import { resolvePackConfig } from '@/lib/packs/packConfig';
import { createFairRng, hashServerSeed } from '@/lib/packs/provablyFair';
import type { PackType } from '@/types/pack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    serverSeed: z.string().trim().min(1).max(256),
    clientSeed: z.string().trim().min(1).max(256),
    nonce: z.number().int().min(0),
    packType: z.string().trim().min(1).max(32),
    /** Optional SOL/USD used at open time (does not affect the random outcome,
     *  only display pricing). */
    solUsd: z.number().positive().optional(),
  })
  .strict();

/**
 * PUBLIC verification. Given a revealed `serverSeed` + the `clientSeed` + `nonce`
 * + `packType`, recompute the outcome deterministically so a player can confirm
 * the pack they received matches the committed seed. The random selection (slot
 * rarities, token, value-in-SOL) is fully reproducible; only display pricing
 * (USD) depends on market data and is intentionally omitted. No auth — it only
 * computes over values the caller supplies.
 */
export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  let result;
  try {
    const config = resolvePackConfig(body.packType as PackType, body.solUsd ?? 150);
    const rng = createFairRng(body.serverSeed, body.clientSeed, body.nonce);
    result = openPackServer(config, rng);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'verify_failed';
    return NextResponse.json({ error: 'verify_failed', message }, { status: 400 });
  }

  return NextResponse.json({
    serverSeedHash: hashServerSeed(body.serverSeed),
    packType: body.packType,
    nonce: body.nonce,
    highlightRarity: result.highlightRarity,
    isJackpotPull: result.isJackpotPull,
    rewards: result.rewards.map((r) => ({
      rarity: r.rarity,
      kind: r.kind,
      tokenSymbol: r.tokenSymbol ?? null,
      tokenName: r.tokenName ?? null,
      valueSol: r.valueSol ?? null,
    })),
  });
}
