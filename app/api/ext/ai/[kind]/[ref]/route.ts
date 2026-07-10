import { NextResponse, type NextRequest } from 'next/server';
import { requireExtAuth } from '@/lib/ext/auth';
import { explainToken } from '@/lib/ai/pipelines/explainToken';
import { explainWallet } from '@/lib/ai/pipelines/explainWallet';
import { tokenNarrative } from '@/lib/ai/pipelines/tokenNarrative';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ext AI summaries. Reuses the app's gated pipelines (`explainToken`/`explainWallet`
 * → `runCascade`), so the SAME access policy applies (≥5 SOL OR subscription via
 * assertAiAccess), the SAME prompt-sanitization/anti-injection, and the SAME shared
 * cache (cache hits are ~instant). The model is backend-agnostic — Claude today,
 * Pointer-7 later, no caller change. (Token streaming is a later refinement; cached
 * pulls already return fast.)
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string; ref: string }> }) {
  const auth = await requireExtAuth(req);
  if ('response' in auth) return auth.response;

  const { kind, ref } = await ctx.params;
  if (!ref || !isValidPublicKey(ref)) {
    return NextResponse.json({ error: 'invalid_ref' }, { status: 400 });
  }

  try {
    if (kind === 'recap') {
      // Free-tier 24h X-native narrative (Grok). Not aiAccess-gated — it's the
      // simple AI on the free plan. Soft-unavailable when Grok isn't configured
      // (no paywall on the free feature).
      const n = await tokenNarrative(ref, Date.now());
      if (!n) {
        return NextResponse.json({ kind, ref, ai: null, unavailable: 'recap_not_configured' });
      }
      return NextResponse.json({
        kind,
        ref,
        ai: { summary: n.narrative, model: n.model },
        cached: n.cached,
      });
    }
    if (kind === 'token') {
      const r = await explainToken({ userId: auth.userId, mint: ref, surface: 'hover' });
      return NextResponse.json({ kind, ref, ai: r.data, cached: r.cacheHit });
    }
    if (kind === 'wallet') {
      const r = await explainWallet({ userId: auth.userId, address: ref });
      return NextResponse.json({ kind, ref, ai: r.data, cached: r.cacheHit });
    }
    return NextResponse.json({ error: 'unsupported_kind' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'ai_failed';
    // assertAiAccess / quota → 403 so the extension can show the unlock-progress UI.
    const status = /access|forbidden|denied|quota|subscription|holdings|unauthenticated/i.test(msg)
      ? 403
      : 500;
    return NextResponse.json({ error: 'ai_unavailable', detail: msg }, { status });
  }
}
