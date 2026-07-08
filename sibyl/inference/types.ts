import 'server-only';

/**
 * Sibyl execution modes — the ONE flag that turns confidential compute on. This is
 * an optional layer behind the model router; the intelligence pipeline (agents,
 * judge, retrieval, flywheel) is identical across all three. See
 * docs/SIBYL_CONFIDENTIAL_COMPUTE.md.
 *
 *  fast         — normal: OpenRouter, per-token, cheapest. Default.
 *  secure       — anonymized retrieval + zero-retention (still the normal model).
 *                 Near-free privacy: your research isn't logged or linkable.
 *  confidential — TEE inference (attested enclave, open model) + everything `secure`
 *                 does. The fund/enterprise mode. Fails CLOSED if not attested.
 */
export type InferenceMode = 'fast' | 'secure' | 'confidential';

export const INFERENCE_MODES: readonly InferenceMode[] = ['fast', 'secure', 'confidential'];

/** Anonymized retrieval + zero-retention apply to secure AND confidential. */
export function isPrivateMode(mode: InferenceMode): boolean {
  return mode === 'secure' || mode === 'confidential';
}

/** Result of verifying the confidential enclave before any prompt is sent. */
export type AttestationResult = {
  /** True only when the hardware quote's measurements match our expected policy. */
  verified: boolean;
  provider: string | null;
  /** Hash of the exact model weights running in the enclave (funds pin this). */
  modelHash: string | null;
  /** The attested VM/firmware measurement. */
  measurement: string | null;
  /** Opaque reference to the raw quote (for a customer's own verifier). */
  quoteRef: string | null;
  verifiedAt: string;
  /** Present when not verified — why. */
  reason?: string;
};
