import 'server-only';

import type { AttestationResult } from '@/sibyl/inference/types';

/**
 * Fetch + verify the confidential enclave's attestation BEFORE any prompt is sent.
 *
 * SCAFFOLD (inert until configured): this verifies the provider's quote against our
 * expected measurement + model hash from env. A production build swaps the compare
 * step for the provider's real verifier library — Azure MAA, NVIDIA NRAS, or Phala's
 * dual (Intel TDX + NVIDIA) quote verifier — but the CONTRACT here is final:
 *   - unconfigured → verified:false (caller decides: fail-closed for `confidential`)
 *   - quote/measurement/model-hash mismatch → verified:false (NEVER trust it)
 *   - only an exact policy match → verified:true
 *
 * We never send a prompt to an enclave we couldn't verify. That's the whole product.
 */

let cached: { at: number; result: AttestationResult } | null = null;
const TTL_MS = 5 * 60_000;

function envMeasurement(): string | null {
  return process.env.SIBYL_CONFIDENTIAL_EXPECTED_MEASUREMENT?.trim() || null;
}
function envModelHash(): string | null {
  return process.env.SIBYL_CONFIDENTIAL_MODEL_HASH?.trim() || null;
}
function envProvider(): string | null {
  return process.env.SIBYL_CONFIDENTIAL_PROVIDER?.trim() || null;
}

export function attestationConfigured(): boolean {
  return Boolean(process.env.SIBYL_CONFIDENTIAL_ATTESTATION_URL?.trim());
}

export function getCachedAttestation(): AttestationResult | null {
  return cached && Date.now() - cached.at < TTL_MS ? cached.result : null;
}

export async function fetchAndVerifyAttestation(force = false): Promise<AttestationResult> {
  const fresh = getCachedAttestation();
  if (fresh && !force) return fresh;

  const url = process.env.SIBYL_CONFIDENTIAL_ATTESTATION_URL?.trim();
  const now = new Date().toISOString();
  const provider = envProvider();
  const expectedMeasurement = envMeasurement();
  const expectedModelHash = envModelHash();

  if (!url) {
    // Not configured — do NOT cache (config may arrive without a restart).
    return { verified: false, provider, modelHash: expectedModelHash, measurement: null, quoteRef: null, verifiedAt: now, reason: 'attestation_not_configured' };
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      return { verified: false, provider, modelHash: expectedModelHash, measurement: null, quoteRef: null, verifiedAt: now, reason: `attestation_http_${res.status}` };
    }
    const quote = (await res.json()) as { measurement?: string; modelHash?: string; quoteId?: string };
    const measurement = quote.measurement ?? null;
    const modelHash = quote.modelHash ?? expectedModelHash;

    // Policy check: when an expected value is configured it MUST match exactly.
    const measurementOk = !expectedMeasurement || measurement === expectedMeasurement;
    const modelOk = !expectedModelHash || modelHash === expectedModelHash;
    const verified = Boolean(measurement && measurementOk && modelOk);

    const result: AttestationResult = {
      verified,
      provider,
      modelHash,
      measurement,
      quoteRef: quote.quoteId ?? null,
      verifiedAt: now,
      reason: verified ? undefined : 'measurement_or_model_mismatch',
    };
    if (verified) cached = { at: Date.now(), result };
    return result;
  } catch {
    return { verified: false, provider, modelHash: expectedModelHash, measurement: null, quoteRef: null, verifiedAt: now, reason: 'attestation_error' };
  }
}
