import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { askSibyl } from '@/sibyl/orchestrator';
import { getSibylUsage, sibylUserId } from '@/sibyl/serverAuth';
import { resolveExecMode } from '@/sibyl/inference/resolveMode';
import type { AttestationResult } from '@/sibyl/inference/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/sibyl/chat — the one intelligence endpoint. The dashboard, the future
 * public API (/v1/token/analyze …), mobile, and the extension all call this.
 *
 * Server owns the plan: the caller's tier + daily cap are resolved from the Privy
 * session (never the request body), so a client can't spoof a higher tier. Over
 * the cap → 429; near the cap → we quietly degrade one tier to protect margin.
 * The scan is attributed to the user so the flywheel meters usage.
 */
const Body = z.object({
  query: z.string().trim().min(1).max(500),
  /** Execution mode — fast (default) / secure / confidential (TEE). */
  mode: z.enum(['fast', 'secure', 'confidential']).optional(),
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

  const userId = await sibylUserId(req);
  const usage = await getSibylUsage(userId);
  if (usage.overCap) {
    return NextResponse.json(
      {
        error: 'daily_cap_reached',
        message: `You've used all ${usage.cap} ${usage.tokenUsage} scans for today. Resets at 00:00 UTC — upgrade for more.`,
        usage: { used: usage.used, cap: usage.cap, resetAt: usage.resetAtIso },
      },
      { status: 429 },
    );
  }

  try {
    const resolved = resolveExecMode(parsed.data.mode, usage.effectiveTier);
    let attestation: AttestationResult | null = null;
    const answer = await askSibyl(parsed.data.query, usage.effectiveTier, {
      userId,
      execMode: resolved.applied,
      onAttestation: (a) => {
        attestation = a;
      },
    });
    return NextResponse.json({
      answer,
      mode: resolved,
      ...(attestation ? { attestation } : {}),
      usage: { used: usage.used + 1, cap: usage.cap, remaining: usage.cap > 0 ? Math.max(0, usage.cap - usage.used - 1) : null },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'sibyl_failed' }, { status: 500 });
  }
}
