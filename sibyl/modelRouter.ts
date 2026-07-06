import 'server-only';

import type { ScanMode } from '@/sibyl/types';
import { sibylMockMode } from '@/sibyl/config';

/**
 * Model router — the margin engine. Sibyl never sends every call to a frontier
 * model. Cheap models do 80–95% of the work (extraction, per-agent analysis);
 * only the DEEP_SCAN/RESEARCH judge escalates. Every model id is env-driven so you
 * swap providers (OpenRouter / Together / Fireworks / DeepSeek / Groq / Gemini)
 * without touching agent code.
 */

export type ModelTier = 'cheap' | 'reason' | 'tool' | 'judge';

/**
 * Default model ids per tier — override via env. All verified live on OpenRouter.
 * cheap/tool = fast + cheap (bulk extraction / JSON); reason = strong value model
 * for standard analysis; judge = premium synthesis (runs once per scan).
 */
function modelForTier(tier: ModelTier): string {
  switch (tier) {
    case 'cheap':
      return process.env.SIBYL_MODEL_CHEAP?.trim() || 'google/gemini-2.5-flash';
    case 'reason':
      return process.env.SIBYL_MODEL_REASON?.trim() || 'deepseek/deepseek-chat';
    case 'tool':
      return process.env.SIBYL_MODEL_TOOL?.trim() || 'google/gemini-2.5-flash';
    case 'judge':
      return process.env.SIBYL_MODEL_JUDGE?.trim() || 'google/gemini-2.5-pro';
  }
}

/** Which tier a scan mode leans on for its heaviest step. */
export function tierForMode(mode: ScanMode): ModelTier {
  switch (mode) {
    case 'HOVER_FAST':
      return 'cheap';
    case 'QUICK_SCAN':
      return 'cheap';
    case 'STANDARD_SCAN':
      return 'reason';
    case 'DEEP_SCAN':
    case 'RESEARCH_REPORT':
      return 'judge';
  }
}

const GATEWAY_URL = process.env.SIBYL_MODEL_BASE_URL?.trim() || 'https://openrouter.ai/api/v1/chat/completions';

function apiKey(): string | null {
  return (
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.SIBYL_MODEL_API_KEY?.trim() ||
    process.env.GROQ_API_KEY?.trim() ||
    null
  );
}

export type CallModelInput = {
  tier: ModelTier;
  system: string;
  user: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Returned verbatim in mock mode — pass a valid JSON string for JSON agents. */
  mock: string;
};

/**
 * One completion. In mock mode (no keys) returns `mock` so the whole pipeline runs
 * offline. In real mode calls the OpenAI-compatible gateway; on any error falls back
 * to `mock` so a provider blip never breaks a scan.
 */
export async function callModel(input: CallModelInput): Promise<string> {
  if (sibylMockMode()) return input.mock;
  const key = apiKey();
  if (!key) return input.mock;

  const model = modelForTier(input.tier);
  try {
    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': 'https://ai.pointer.trade',
        'X-Title': 'Sibyl by Pointer',
      },
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0.4,
        max_tokens: input.maxTokens ?? 700,
        ...(input.json ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return input.mock;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : input.mock;
  } catch {
    return input.mock;
  }
}

/** Parse a model's JSON reply defensively (handles ```json fences + junk). */
export function parseJson<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) return fallback;
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return fallback;
  }
}
