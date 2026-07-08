import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSibylUsage, sibylUserId } from '@/sibyl/serverAuth';
import { resolveExecMode } from '@/sibyl/inference/resolveMode';
import { fetchAndVerifyAttestation, getCachedAttestation } from '@/sibyl/inference/attestation';
import { confidentialAllowUnverified } from '@/sibyl/inference/confidential';
import { SIBYL_GENERAL_SYSTEM, generalUpstream } from '@/sibyl/general/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/sibyl/general/stream — the GENERAL private AI chat (Venice-style).
 * Token-streams a plain completion; NO crypto Council. Fast (Oracle) → OpenRouter;
 * confidential (Veil) → the attested Phala TEE endpoint. Zero-retention: nothing
 * about the prompt/response is logged.
 */
const Msg = z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(8000) });
const Body = z.object({
  query: z.string().trim().min(1).max(4000),
  mode: z.enum(['fast', 'secure', 'confidential']).optional(),
  history: z.array(Msg).max(20).optional(),
});

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return new Response(sse('error', { message: 'invalid_body' }), { status: 400, headers: { 'Content-Type': 'text/event-stream' } });
  }

  const userId = await sibylUserId(req);
  const usage = await getSibylUsage(userId);
  if (usage.overCap) {
    return new Response(
      sse('cap', { message: `Daily limit reached (${usage.cap}). Resets 00:00 UTC — upgrade for more.` }),
      { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } },
    );
  }

  const resolved = resolveExecMode(body.mode, usage.effectiveTier);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: string, data: unknown) => controller.enqueue(encoder.encode(sse(event, data)));
      try {
        emit('mode', resolved);

        // Confidential (Veil): verify the enclave BEFORE sending; fail closed.
        if (resolved.applied === 'confidential') {
          const attestation = getCachedAttestation() ?? (await fetchAndVerifyAttestation());
          emit('attestation', attestation);
          if (!attestation.verified && !confidentialAllowUnverified()) {
            emit('error', { message: 'Confidential enclave could not be verified.' });
            controller.close();
            return;
          }
        }

        const { endpoint, key, model } = generalUpstream(resolved.applied);
        if (!endpoint || !key) {
          emit('token', { t: 'Sibyl isn’t configured for this mode yet.' });
          emit('done', { usage: { used: usage.used, cap: usage.cap } });
          controller.close();
          return;
        }

        const messages = [
          { role: 'system', content: SIBYL_GENERAL_SYSTEM },
          ...(body.history ?? []).slice(-8),
          { role: 'user', content: body.query },
        ];

        const upstream = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
            'HTTP-Referer': 'https://pointer.trade',
            'X-Title': 'Sibyl by Pointer',
          },
          body: JSON.stringify({ model, stream: true, temperature: 0.6, max_tokens: 1200, messages }),
          signal: AbortSignal.timeout(120_000),
        });
        if (!upstream.ok || !upstream.body) {
          emit('error', { message: `upstream_${upstream.status}` });
          controller.close();
          return;
        }

        // Forward the OpenAI-style token deltas as our own `token` events.
        const reader = upstream.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            const l = line.trim();
            if (!l.startsWith('data:')) continue;
            const payload = l.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const j = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
              const t = j.choices?.[0]?.delta?.content;
              if (t) emit('token', { t });
            } catch {
              /* ignore keep-alive / non-JSON lines */
            }
          }
        }
        emit('done', { usage: { used: usage.used + 1, cap: usage.cap, remaining: usage.cap > 0 ? Math.max(0, usage.cap - usage.used - 1) : null } });
      } catch (e) {
        emit('error', { message: e instanceof Error ? e.message : 'general_failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
  });
}
