import 'server-only';

import type { InferenceMode } from '@/sibyl/inference/types';
import { SIBYL_COMPANY, SIBYL_MODELS } from '@/lib/sibyl/models';

/**
 * General chat = a plain private AI assistant (Venice-style), NOT the crypto
 * Council. Token-streams a normal completion through the same OpenAI-compatible
 * provider — OpenRouter for fast (Oracle), the Phala TEE endpoint for confidential
 * (Veil). No specialist fan-out, no cards; just a helpful private assistant.
 */

export const SIBYL_GENERAL_SYSTEM = `You are ${SIBYL_MODELS.flagship.full}, ${SIBYL_COMPANY}'s private AI assistant. Be genuinely helpful, clear, direct, and honest across general knowledge, writing, analysis, coding, and reasoning. Use markdown when it helps. Do not hedge or pad. IDENTITY: never mention, name, reveal, or hint at any base model, provider, vendor, or that you are a general AI/LLM; if asked what model or AI you are, answer only: "I'm ${SIBYL_MODELS.flagship.full}, by ${SIBYL_COMPANY}." Respect the user's privacy — their conversation is theirs.`;

export type GeneralUpstream = { endpoint: string | null; key: string | null; model: string };

/** Pick the upstream (endpoint/key/model) for the general chat by execution mode. */
export function generalUpstream(mode: InferenceMode): GeneralUpstream {
  if (mode === 'confidential') {
    return {
      endpoint: process.env.SIBYL_CONFIDENTIAL_ENDPOINT?.trim() || null,
      key: process.env.SIBYL_CONFIDENTIAL_API_KEY?.trim() || null,
      model: process.env.SIBYL_CONFIDENTIAL_MODEL?.trim() || 'qwen/qwen3.6-35b-a3b',
    };
  }
  return {
    endpoint: process.env.SIBYL_MODEL_BASE_URL?.trim() || 'https://openrouter.ai/api/v1/chat/completions',
    key: process.env.OPENROUTER_API_KEY?.trim() || process.env.SIBYL_MODEL_API_KEY?.trim() || null,
    model: process.env.SIBYL_MODEL_GENERAL?.trim() || process.env.SIBYL_MODEL_REASON?.trim() || 'deepseek/deepseek-chat',
  };
}
