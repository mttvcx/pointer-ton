import 'server-only';

/**
 * xAI Grok client (OpenAI-compatible chat). Grok is the pick for X-native, real-time
 * narrative ("why did $ANSEM run in the last 24h") because it has live access to the
 * X firehose — with `search_parameters` it reasons from actual recent posts, which
 * Claude/GPT can't do without being fed the context.
 *
 * KEY-GATED: dormant unless XAI_API_KEY is set. Callers should fall back to the
 * on-chain explainToken pipeline when this returns null.
 */

const XAI_BASE = 'https://api.x.ai/v1/chat/completions';

export function grokConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY?.trim());
}

export type GrokMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type GrokOptions = {
  /** Enable live X (+ web) search so the model grounds on real recent posts. */
  liveSearch?: boolean;
  maxSearchResults?: number;
  temperature?: number;
  maxTokens?: number;
  /** Restrict search recency, e.g. '24h' → from date computed by caller. */
  fromDateIso?: string | null;
};

/**
 * One Grok completion. Returns the assistant text, or null if not configured / on
 * any error (so callers degrade gracefully rather than throw on a hover path).
 */
export async function grokComplete(messages: GrokMessage[], opts: GrokOptions = {}): Promise<string | null> {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) return null;
  const model = process.env.XAI_MODEL?.trim() || 'grok-3';

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? 0.5,
    max_tokens: opts.maxTokens ?? 320,
  };

  if (opts.liveSearch) {
    // xAI Live Search — ground on X (and web) posts. Shape per xAI docs; extra keys
    // are ignored server-side if unsupported, so this stays forward-compatible.
    body.search_parameters = {
      mode: 'auto',
      max_search_results: opts.maxSearchResults ?? 12,
      sources: [{ type: 'x' }, { type: 'web' }],
      ...(opts.fromDateIso ? { from_date: opts.fromDateIso } : {}),
    };
  }

  try {
    const res = await fetch(XAI_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn('[grok] http', res.status);
      return null;
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch (e) {
    console.warn('[grok] request failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
