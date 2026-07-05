import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { askSibyl } from '@/sibyl/orchestrator';
import type { PlanTier } from '@/sibyl/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/sibyl/chat — the one intelligence endpoint. The dashboard, the future
 * public API (/v1/token/analyze …), mobile, and the extension all call this. MVP is
 * public at FREE tier (mock mode needs no keys); plan gating + auth + rate limits
 * are the next-step wrappers around this same call.
 */
const Body = z.object({
  query: z.string().trim().min(1).max(500),
  tier: z.enum(['FREE', 'PRO', 'PRO_PLUS', 'MAX', 'ENTERPRISE']).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  try {
    const answer = await askSibyl(parsed.data.query, (parsed.data.tier as PlanTier) ?? 'FREE');
    return NextResponse.json({ answer });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'sibyl_failed' }, { status: 500 });
  }
}
