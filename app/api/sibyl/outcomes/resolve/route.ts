import { NextResponse } from 'next/server';
import { dexscreener } from '@/sibyl/data/providers';
import * as db from '@/sibyl/memory/db';
import { gradeOutcome } from '@/sibyl/memory/persist';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Grade pending predictions against what actually happened. Lazy resolution already
 * covers tokens that get re-scanned; this catches tokens scanned once and never
 * revisited. Re-fetches current MC/liq from DexScreener (public) and closes them out.
 * Callable manually or by a sparse cron (kept off the default schedule for cost).
 */
async function run() {
  const pending = await db.pendingOutcomesOlderThan(6, 40);
  const now = new Date().toISOString();
  let resolved = 0;
  for (const p of pending) {
    try {
      const m = await dexscreener.getMarketFacts(p.subject_ref, (p.chain as 'sol' | 'eth' | 'base' | 'bnb') ?? 'sol');
      if (m.marketCapUsd == null) continue; // no live data yet — leave pending
      await db.resolveOutcome(p.id, gradeOutcome(p.prediction, m.marketCapUsd, m.priceUsd, m.liquidityUsd, p.predicted_at), now);
      resolved += 1;
    } catch {
      /* skip this one */
    }
  }
  return { checked: pending.length, resolved };
}

export async function GET() {
  return NextResponse.json(await run());
}
export async function POST() {
  return NextResponse.json(await run());
}
