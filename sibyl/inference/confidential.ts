import 'server-only';

import type { AttestationResult } from '@/sibyl/inference/types';
import { fetchAndVerifyAttestation, getCachedAttestation } from '@/sibyl/inference/attestation';

/**
 * Confidential inference backend — the TEE counterpart to the normal OpenRouter
 * call in modelRouter. Talks to an OpenAI-compatible endpoint running an open model
 * inside an attested enclave (Phala / Azure Confidential Inferencing / GCP
 * Confidential Space). Inert until `SIBYL_CONFIDENTIAL_ENDPOINT` is set.
 *
 * ZERO-RETENTION: this path logs NOTHING about the prompt or response. The whole
 * point is that no plaintext trace exists off the enclave.
 *
 * FAIL-CLOSED: we verify the enclave's attestation before sending. If it can't be
 * verified, we return no text — the caller must NOT silently downgrade to a
 * non-confidential model (that would break the guarantee we sold).
 */

export function confidentialConfigured(): boolean {
  return Boolean(process.env.SIBYL_CONFIDENTIAL_ENDPOINT?.trim());
}

/** Fail closed by default; override only for the softer `secure` fallback path. */
export function confidentialFailClosed(): boolean {
  return process.env.SIBYL_CONFIDENTIAL_FAIL_OPEN?.trim() !== '1';
}

/**
 * TESTING ONLY. When `SIBYL_CONFIDENTIAL_ALLOW_UNVERIFIED=1`, the enclave call
 * proceeds even if attestation isn't verified yet (badge shows "unverified"). Lets
 * you smoke-test the TEE endpoint before the provider-specific attestation adapter
 * is wired. NEVER set this in production — it removes the whole guarantee.
 */
export function confidentialAllowUnverified(): boolean {
  return process.env.SIBYL_CONFIDENTIAL_ALLOW_UNVERIFIED?.trim() === '1';
}

/**
 * Per-tier confidential model — preserves Sibyl's multi-model design INSIDE the
 * enclave: run a cheap open model for the 7 agents (bulk extraction) and a stronger
 * one for the judge (synthesis), exactly like the normal router does. Set
 * `SIBYL_CONFIDENTIAL_MODEL_CHEAP` / `_REASON` / `_TOOL` / `_JUDGE` to differentiate;
 * otherwise everything uses `SIBYL_CONFIDENTIAL_MODEL`.
 */
function confidentialModelForTier(tier?: string): string {
  const perTier = tier ? process.env[`SIBYL_CONFIDENTIAL_MODEL_${tier.toUpperCase()}`]?.trim() : undefined;
  return perTier || process.env.SIBYL_CONFIDENTIAL_MODEL?.trim() || 'qwen/qwen3.6-35b-a3b';
}

export type ConfidentialCallInput = {
  system: string;
  user: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Router tier (cheap/reason/tool/judge) → picks the per-tier confidential model. */
  tier?: string;
};

export type ConfidentialCallResult = {
  /** null when the enclave couldn't be verified or the call failed. */
  text: string | null;
  attestation: AttestationResult;
};

export async function callConfidentialModel(input: ConfidentialCallInput): Promise<ConfidentialCallResult> {
  const endpoint = process.env.SIBYL_CONFIDENTIAL_ENDPOINT?.trim();
  const key = process.env.SIBYL_CONFIDENTIAL_API_KEY?.trim();

  // Reuse a cached verified attestation across the many model calls in one scan.
  const attestation = getCachedAttestation() ?? (await fetchAndVerifyAttestation());
  // Proceed only if attested — unless the testing switch explicitly allows it.
  if (!endpoint || (!attestation.verified && !confidentialAllowUnverified())) {
    return { text: null, attestation };
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({
        model: confidentialModelForTier(input.tier),
        temperature: input.temperature ?? 0.4,
        max_tokens: input.maxTokens ?? 700,
        ...(input.json ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return { text: null, attestation };
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim() ?? null;
    return { text: text && text.length > 0 ? text : null, attestation };
  } catch {
    return { text: null, attestation };
  }
}
