import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSibylUsage, sibylUserId } from '@/sibyl/serverAuth';
import { falConfigured, falImage } from '@/sibyl/generate/fal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/sibyl/image — generate an image from a prompt via fal.ai.
 * Body { prompt, model?, aspectRatio? }. Returns { url } or { error, message }.
 * Honestly gated: no FAL_KEY → { error:'not_configured' }.
 */
const Body = z.object({
  prompt: z.string().trim().min(1).max(2000),
  model: z.string().max(80).optional(),
  aspectRatio: z.string().max(40).optional(),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  const userId = await sibylUserId(req);
  const usage = await getSibylUsage(userId);
  if (usage.overCap) {
    return Response.json({ error: 'cap', message: `Daily limit reached (${usage.cap}). Resets 00:00 UTC.` }, { status: 200 });
  }
  if (!falConfigured()) {
    return Response.json({ error: 'not_configured', message: 'Image generation is not configured yet. Add FAL_KEY.' }, { status: 200 });
  }

  try {
    const url = await falImage(body.model, body.prompt, body.aspectRatio);
    return Response.json({ url });
  } catch (e) {
    return Response.json({ error: 'generation_failed', message: e instanceof Error ? e.message : 'failed' }, { status: 200 });
  }
}
