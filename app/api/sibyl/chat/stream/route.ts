import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { askSibyl, type SibylStage } from '@/sibyl/orchestrator';
import { getSibylUsage, sibylUserId } from '@/sibyl/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/sibyl/chat/stream — the streaming twin of /api/sibyl/chat. Emits the
 * REAL pipeline progress as Server-Sent Events (one `stage` event per agent as it
 * starts/finishes), then a final `answer` event with the structured result. The
 * web dashboard uses this for a live "thinking" trace + typed-out answer; the JSON
 * route stays for mobile / extension / the public API.
 *
 * Same server-owned plan enforcement as the JSON route: tier + cap from the Privy
 * session, never the body.
 */
const Body = z.object({ query: z.string().trim().min(1).max(500) });

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(sse('error', { message: 'invalid_json' }), { status: 400, headers: { 'Content-Type': 'text/event-stream' } });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return new Response(sse('error', { message: 'invalid_body' }), { status: 400, headers: { 'Content-Type': 'text/event-stream' } });
  }

  const userId = await sibylUserId(req);
  const usage = await getSibylUsage(userId);
  if (usage.overCap) {
    return new Response(
      sse('cap', {
        message: `You've used all ${usage.cap} ${usage.tokenUsage} scans for today. Resets at 00:00 UTC — upgrade for more.`,
        usage: { used: usage.used, cap: usage.cap, resetAt: usage.resetAtIso },
      }),
      { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: string, data: unknown) => controller.enqueue(encoder.encode(sse(event, data)));
      try {
        const answer = await askSibyl(parsed.data.query, usage.effectiveTier, {
          userId,
          onStage: (s: SibylStage) => emit('stage', s),
        });
        emit('answer', {
          answer,
          usage: { used: usage.used + 1, cap: usage.cap, remaining: usage.cap > 0 ? Math.max(0, usage.cap - usage.used - 1) : null },
        });
      } catch (e) {
        emit('error', { message: e instanceof Error ? e.message : 'sibyl_failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
